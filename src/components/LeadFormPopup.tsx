import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { usePracticeAreas } from '@/hooks/usePracticeAreas';
import { db } from '@/lib/supabase-helpers';

const LeadFormPopup = () => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const { areas } = usePracticeAreas();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', practice_area_id: '', message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { error } = await db.from('leads').insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone,
      practice_area_id: form.practice_area_id || null,
      message: form.message || null,
      status: 'new',
      kanban_status: 'new',
    });

    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Solicitação enviada!', description: 'Entraremos em contato em breve.' });
      setForm({ name: '', email: '', phone: '', practice_area_id: '', message: '' });
      setOpen(false);
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 bg-accent rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 animate-pulse-glow group"
        aria-label="Solicitar atendimento"
      >
        <MessageCircle className="w-8 h-8 text-accent-foreground" />
        <span className="absolute right-full mr-3 bg-card text-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Solicitar Atendimento
        </span>
      </button>

      {/* Popup Overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">Solicitar Atendimento</h3>
                <p className="text-xs text-muted-foreground mt-1">Preencha os dados abaixo</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Seu nome" className="bg-background" required />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Telefone *</Label>
                <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" className="bg-background" required />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Área de Atendimento</Label>
                <select
                  value={form.practice_area_id}
                  onChange={(e) => setForm(p => ({ ...p, practice_area_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm"
                >
                  <option value="">Selecione</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Mensagem</Label>
                <Textarea value={form.message} onChange={(e) => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Descreva sua situação..." rows={3} className="bg-background" />
              </div>
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={sending}>
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Enviando...' : 'Enviar'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadFormPopup;
