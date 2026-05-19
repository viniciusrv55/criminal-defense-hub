
INSERT INTO platform_settings (key, value, description) VALUES
('appointment_confirmation_template', 'Olá {{nome}}! Seu agendamento foi confirmado para {{data}} às {{hora}} com {{advogado}}. Local: {{local}}. Em caso de dúvida, responda esta mensagem.', 'Template de confirmação de agendamento (WhatsApp)'),
('appointment_reminder_template', 'Olá {{nome}}, lembrando: sua consulta com {{advogado}} está marcada para amanhã, {{data}} às {{hora}}. Local: {{local}}. Confirma presença?', 'Template de lembrete 24h (WhatsApp)'),
('appointment_cancelled_template', 'Olá {{nome}}, informamos que o agendamento de {{data}} às {{hora}} foi cancelado. Para reagendar, entre em contato.', 'Template de cancelamento (WhatsApp)'),
('brevo_sender_email', 'contato@lindombertomoraes.com.br', 'E-mail remetente padrão Brevo'),
('brevo_sender_name', 'Lindomberto Moraes Advocacia', 'Nome do remetente Brevo'),
('brevo_reply_to', 'contato@lindombertomoraes.com.br', 'Reply-to padrão')
ON CONFLICT (key) DO NOTHING;
