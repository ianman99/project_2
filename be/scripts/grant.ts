import { connectDb, closeDb } from '../src/db';
import { grant } from '../src/services/points.service';

async function main() {
  await connectDb();
  const [userId, amount, ...memo] = process.argv.slice(2);
  const balance = await grant(userId, Number(amount), '6155', memo.join(' ') || '어드민 지급');
  console.log(`${userId}: ${Number(amount).toLocaleString()} P 지급 → 잔액 ${balance.toLocaleString()} P`);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
