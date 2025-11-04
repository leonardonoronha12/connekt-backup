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
    const { token, type } = await req.json()

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar o token de confirmação
    const { data, error } = await supabaseClient.auth.verifyOtp({
      token_hash: token,
      type: type || 'signup'
    })

    if (error) {
      throw error
    }

    // Template HTML de sucesso personalizado para Connekt
    const successTemplate = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Confirmado - Connekt</title>
        <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #34A853 0%, #0F9D58 100%); padding: 40px 20px; text-align: center; }
            .success-icon { font-size: 48px; margin-bottom: 20px; }
            .logo { color: white; font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .header-text { color: white; font-size: 18px; opacity: 0.9; }
            .content { padding: 40px 20px; text-align: center; }
            .title { color: #1E1B39; font-size: 28px; font-weight: 600; margin-bottom: 20px; }
            .message { color: #404040; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
            .button { display: inline-block; background: linear-gradient(135deg, #0047BB 0%, #321A88 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .highlight { background-color: #E7EDFC; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { background-color: #f8fafc; padding: 30px 20px; text-align: center; border-top: 1px solid #e3e4e5; }
            .footer-text { color: #9291A5; font-size: 14px; line-height: 1.5; }
        </style>
        <script>
            // Redirecionar automaticamente após 3 segundos
            setTimeout(() => {
                window.location.href = '${Deno.env.get('SITE_URL')}/dashboard?email_confirmed=true';
            }, 3000);
        </script>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success-icon">✅</div>
                <div class="logo">🎓 Connekt</div>
                <div class="header-text">Email confirmado com sucesso!</div>
            </div>
            
            <div class="content">
                <h1 class="title">🎉 Parabéns!</h1>
                
                <p class="message">
                    Seu email foi confirmado com sucesso! Sua conta na <strong>Connekt</strong> está agora ativa e pronta para uso.
                </p>
                
                <div class="highlight">
                    <p class="message" style="margin: 0;">
                        <strong>🚀 Próximos passos:</strong><br>
                        Você será redirecionado automaticamente para o dashboard em alguns segundos, onde poderá completar seu perfil e começar a vender seus cursos!
                    </p>
                </div>
                
                <div style="text-align: center;">
                    <a href="${Deno.env.get('SITE_URL')}/dashboard?email_confirmed=true" class="button">
                        🏠 Ir para o Dashboard
                    </a>
                </div>
                
                <p class="message" style="font-size: 14px; color: #9291A5;">
                    Redirecionamento automático em 3 segundos...
                </p>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    <strong>Bem-vindo(a) à Connekt!</strong><br>
                    Agora você pode aproveitar todos os recursos da nossa plataforma.
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

    return new Response(successTemplate, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
      status: 200,
    })

  } catch (error) {
    // Template de erro personalizado
    const errorTemplate = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erro na Confirmação - Connekt</title>
        <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 40px 20px; text-align: center; }
            .error-icon { font-size: 48px; margin-bottom: 20px; }
            .logo { color: white; font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .content { padding: 40px 20px; text-align: center; }
            .title { color: #1E1B39; font-size: 28px; font-weight: 600; margin-bottom: 20px; }
            .message { color: #404040; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
            .button { display: inline-block; background: linear-gradient(135deg, #0047BB 0%, #321A88 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="error-icon">❌</div>
                <div class="logo">🎓 Connekt</div>
            </div>
            
            <div class="content">
                <h1 class="title">Ops! Algo deu errado</h1>
                
                <p class="message">
                    Não foi possível confirmar seu email. O link pode ter expirado ou já ter sido usado.
                </p>
                
                <p class="message">
                    <strong>Erro:</strong> ${error.message}
                </p>
                
                <div style="text-align: center;">
                    <a href="${Deno.env.get('SITE_URL')}/login" class="button">
                        🔄 Tentar novamente
                    </a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `

    return new Response(errorTemplate, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
      status: 400,
    })
  }
})