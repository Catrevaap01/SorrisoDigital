## Edge Function `send-email` (Supabase)

Use este exemplo para ativar o envio de email real no app.

### 1) Criar função
```bash
supabase functions new send-email
```

### 2) Conteúdo de `supabase/functions/send-email/index.ts`
```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

serve(async (req) => {
  try {
    const body = await req.json()
    const { to, subject, type, data } = body || {}

    // TODO: integre seu provedor (Resend, SendGrid, etc.)
    // Exemplo com Resend:
    // const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    // await fetch('https://api.resend.com/emails', { ... })

    console.log('send-email payload', { to, subject, type, data })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Erro' }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
```

### 3) Deploy
```bash
supabase functions deploy send-email
```

### 4) (Opcional) fallback HTTP
Se quiser usar endpoint externo em vez da Edge Function, adicione no `app.json`:
```json
{
  "expo": {
    "extra": {
      "EMAIL_API_URL": "https://seu-backend.com/api/send-email"
    }
  }
}
```
