import { sendShopSms } from '../server/smsGateway'

async function main() {
  const result = await sendShopSms({
    shopId: 'shop-001',
    to: '0400000000',
    message: 'Test booking confirm',
    priority: 'critical',
  })
  console.log('SMS gate test result:', result)
  console.log(
    result.skipped || !result.sent
      ? 'PASS — no SMS sent (disabled / no Supabase / no Twilio)'
      : 'FAIL — SMS was sent unexpectedly'
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
