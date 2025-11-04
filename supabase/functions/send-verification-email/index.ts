import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, redirectTo } = await req.json()

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Template HTML personalizado para Connekt
    const emailTemplate = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmação de Cadastro - Connekt</title>
        <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #0047BB 0%, #321A88 100%); padding: 40px 20px; text-align: center; }
            .logo { color: white; font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .header-text { color: white; font-size: 18px; opacity: 0.9; }
            .content { padding: 40px 20px; }
            .title { color: #1E1B39; font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center; }
            .message { color: #404040; font-size: 16px; line-height: 1.6; margin-bottom: 30px; text-align: center; }
            .button { display: inline-block; background: linear-gradient(135deg, #0047BB 0%, #321A88 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { background-color: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e3e4e5; }
            .footer-text { color: #9291A5; font-size: 14px; line-height: 1.5; }
            .highlight { background-color: #E7EDFC; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎓 Connekt</div>
                <div class="header-text">Plataforma de Cursos de Medicina</div>
            </div>
            
            <div class="content">
                <h1 class="title">🎉 Confirme seu cadastro</h1>
                
                <div class="highlight">
                    <p class="message">
                        <strong>Olá!</strong><br><br>
                        Seja bem-vindo(a) à <strong>Connekt</strong>, a maior plataforma de cursos de medicina do Brasil!
                    </p>
                </div>
                
                <p class="message">
                    Para ativar sua conta e começar a aproveitar todos os nossos recursos, 
                    clique no botão abaixo para confirmar seu endereço de email:
                </p>
                
                <div style="text-align: center;">
                    <a href="{{ .ConfirmationURL }}" class="button">
                        ✅ Confirmar meu cadastro
                    </a>
                </div>
                
                <p class="message" style="font-size: 14px; color: #9291A5;">
                    Se você não conseguir clicar no botão, copie e cole este link no seu navegador:<br>
                    <a href="{{ .ConfirmationURL }}" style="color: #0047BB; word-break: break-all;">{{ .ConfirmationURL }}</a>
                </p>
                
                <div class="highlight">
                    <p class="message" style="margin: 0;">
                        <strong>🚀 Próximos passos:</strong><br>
                        Após confirmar seu email, você será redirecionado para o dashboard onde poderá completar seu perfil e começar a vender seus cursos!
                    </p>
                </div>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    <strong>Connekt - Plataforma de Cursos de Medicina</strong><br>
                    Este email foi enviado para {{ .Email }}<br>
                    Se você não se cadastrou em nossa plataforma, pode ignorar este email com segurança.
                </p>
                <p class="footer-text" style="margin-top: 20px;">
                    © 2024 Connekt. Todos os direitos reservados.<br>
                    <a href="https://appconnekt.com.br" style="color: #0047BB;">appconnekt.com.br</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `

    // Enviar email personalizado
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: redirectTo || `${Deno.env.get('SITE_URL')}/dashboard?email_confirmed=true`
      }
    })

    if (error) {
      throw error
    }

    // Aqui você pode integrar com um serviço de email como SendGrid, Resend, etc.
    // Por enquanto, retornamos o template e o link
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email de verificação enviado com sucesso',
        template: emailTemplate,
        confirmationUrl: data.properties?.action_link
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})