Param(
  [string]$PROJECT_REF = "ucsijwfarkrljbkdvrbd",
  [string]$WEBHOOK_TOKEN = "<MYG_WEBHOOK_TOKEN>",
  [string]$USER_ID = "<uuid>",
  [string]$GATEWAY_PAYMENT_ID = "<gateway_payment_id>",
  [string]$PLAN = "pro",
  [string]$CYCLE = "mensal"
)

$base = "https://$PROJECT_REF.functions.supabase.co"

Write-Host "Testing myg-payments (create payment link)" -ForegroundColor Cyan
$createBody = @{ userId=$USER_ID; planSlug=$PLAN; cycle=$CYCLE } | ConvertTo-Json
$create = Invoke-WebRequest -Uri "$base/myg-payments" -Method POST -Headers @{ 'Content-Type'='application/json' } -Body $createBody
Write-Host $create.Content

Write-Host "Testing myg-payment-webhook (simulate paid)" -ForegroundColor Cyan
$webhookBody = @{ id=$GATEWAY_PAYMENT_ID; status=2 } | ConvertTo-Json
$wh = Invoke-WebRequest -Uri "$base/myg-payment-webhook" -Method POST -Headers @{ 'Authorization'=$WEBHOOK_TOKEN; 'Content-Type'='application/json' } -Body $webhookBody
Write-Host "Webhook response status: $($wh.StatusCode)"

