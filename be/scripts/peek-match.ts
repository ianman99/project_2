import { connectDb, closeDb } from '../src/db';
import { runMatching } from '../src/services/matching.service';

async function main() {
  await connectDb();
  const doc = await runMatching('6155');
  const top = doc.results[0];
  console.log(`1위: ${top.name} ${top.score}%  |  후보 ${doc.results.length}명`);
  console.log(`\n[근거]`);
  top.reasons.forEach((r) => console.log(' -', r));
  console.log(`\n데이트 코스: ${doc.dateCourse ? doc.dateCourse.stops.length + '개' : '실패'}`);
  console.log('토큰:', doc.usage);
  await closeDb();
}
main().catch((e) => { console.error(e); process.exit(1); });
