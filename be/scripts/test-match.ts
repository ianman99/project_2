import { connectDb, closeDb } from '../src/db';
import { runMatching } from '../src/services/matching.service';

async function main() {
  await connectDb();
  const doc = await runMatching('6155');
  console.log('결과 수:', doc.results.length);
  console.log('1위:', doc.results[0].name, doc.results[0].score + '%');
  console.log('데이트 코스:', doc.dateCourse ? `${doc.dateCourse.stops.length}개 코스` : 'null (실패)');
  console.log('토큰:', doc.usage);
  await closeDb();
}
main().catch((e) => { console.error('실패:', e); process.exit(1); });
