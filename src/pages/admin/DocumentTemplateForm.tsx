import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { CreatableCombobox } from '@/components/admin/CreatableCombobox';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/admin/RichTextEditor';
import { DOC_VARIABLES } from '@/lib/document-variables';
import { useDocTemplate, useDocTemplateTypes, useCurrentTeamMember } from '@/hooks/useDocumentTemplates';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/supabase-helpers';
import { toast } from '@/hooks/use-toast';

const DocumentTemplateForm = () => {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const me = useCurrentTeamMember();
  const { template, loading } = useDocTemplate(id);
  const typesHook = useDocTemplateTypes();
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [typeId, setTypeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [docDate, setDocDate] = useState('');
  const [content, setContent] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([]);

  // grupos para inserir variáveis (organizados)
  const groups = ['Cliente', 'Endereço', 'Contrato', 'Processo', 'Honorários', 'Outros'] as const;

  useEffect(() => { db.from('team_members').select('id, full_name').eq('active', true).order('full_name').then(({ data }: { data: { id: string; full_name: string }[] | null }) => setTeam(data ?? [])); }, []);

  useEffect(() => {
    if (template) {
      setTypeId(template.type_id);
      setTitle(template.title);
      setDocDate(template.doc_date ?? '');
      setContent(template.content_html);
      setOwnerId(template.owner_id);
      setAssignedIds(template.assigned_team_member_ids ?? []);
    } else if (isNew && me) {
      setOwnerId(me.id);
    }
  }, [template, isNew, me]);

  const canEdit = isAdmin() || (me && ownerId === me.id) || isNew;

  const handleSave = async (exit = false) => {
    if (!typeId) { toast({ title: 'Selecione o tipo', variant: 'destructive' }); return; }
    if (!title.trim()) { toast({ title: 'Informe o título', variant: 'destructive' }); return; }
    if (!ownerId) { toast({ title: 'Defina o advogado responsável', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      type_id: typeId, title, content_html: content, doc_date: docDate || null,
      owner_id: ownerId, assigned_team_member_ids: assignedIds, created_by: user?.id,
    };
    if (template?.id) {
      const { error } = await db.from('document_templates').update(payload).eq('id', template.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    } else {
      const { data, error } = await db.from('document_templates').insert(payload).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      if (!exit) { navigate(`/admin/documentos/${(data as { id: string }).id}`, { replace: true }); }
    }
    setSaving(false);
    toast({ title: 'Modelo salvo!' });
    if (exit) navigate('/admin/documentos');
  };

  if (loading && !isNew) return <AdminLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/documentos')} className="mb-2"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
        <h1 className="font-serif text-2xl font-bold text-foreground">{isNew ? 'Novo Modelo de Documento' : 'Editar Modelo'}</h1>
        <p className="text-sm text-muted-foreground">Cadastro</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="grid lg:grid-cols-[1fr_1fr_1fr] gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de documento</Label>
            <CreatableCombobox
              value={typeId}
              options={typesHook.types.map(t => ({ value: t.id, label: t.name }))}
              placeholder="Selecione..."
              onChange={setTypeId}
              onCreate={isAdmin() ? async (name) => typesHook.create(name) : undefined}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Inserir variável</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value=""
              onChange={(e) => {
                const token = e.target.value;
                if (token) editorRef.current?.insertText(token);
                e.target.value = '';
              }}
              disabled={!canEdit}
            >
              <option value="">Selecione um campo...</option>
              {groups.map(g => {
                const items = DOC_VARIABLES.filter(v => v.group === g);
                if (!items.length) return null;
                return (
                  <optgroup key={g} label={g}>
                    {items.map(v => <option key={v.token} value={v.token}>{v.label}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Data no documento</Label>
            <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} disabled={!canEdit} />
          </div>
          {isAdmin() && (
            <div className="space-y-1.5">
              <Label className="text-xs">Advogado responsável (dono)</Label>
              <CreatableCombobox
                value={ownerId}
                options={team.map(t => ({ value: t.id, label: t.full_name }))}
                placeholder="Selecione..."
                onChange={setOwnerId}
              />
            </div>
          )}
          {isAdmin() && (
            <div className="space-y-1.5">
              <Label className="text-xs">Compartilhar com (advogados)</Label>
              <select multiple value={assignedIds} onChange={e => setAssignedIds(Array.from(e.target.selectedOptions, o => o.value))}
                className="w-full min-h-[40px] px-2 py-1 rounded-md border border-input bg-background text-sm">
                {team.filter(t => t.id !== ownerId).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground">Ctrl/Cmd + clique para selecionar vários</p>
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs mb-1.5 block">Conteúdo do modelo</Label>
          <RichTextEditor ref={editorRef} value={content} onChange={setContent} placeholder="Digite o texto do modelo. Use o seletor 'Inserir variável' para adicionar campos como [NOMECLIENTE], [CPFCLIENTE]..." />
          <p className="text-[11px] text-muted-foreground mt-2">As variáveis em colchetes (ex.: <code className="text-accent">[NOMECLIENTE]</code>) serão substituídas pelos dados reais quando o documento for gerado a partir de um contrato.</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/admin/documentos')}>Cancelar</Button>
        <Button onClick={() => handleSave(true)} disabled={saving || !canEdit} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </AdminLayout>
  );
};

export default DocumentTemplateForm;
