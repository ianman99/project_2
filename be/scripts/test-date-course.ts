// 데이트 코스 생성만 단독 검증한다. 포인트 차감·DB 저장 없음.
import { connectDb, closeDb } from '../src/db';
import { students } from '../src/db/collections';
import { buildDateCourse } from '../src/services/matching.service';

async function main() {
  await connectDb();
  const me = await students().findOne({ _id: '6155' });
  const partner = await students().findOne({ _id: '6123' });
  if (!me || !partner) throw new Error('프로필 없음');

  console.log(`${me.name} × ${partner.name}\n`);
  const { course, usage } = await buildDateCourse(me, partner);
  if (!course) throw new Error('코스 생성 실패');

  console.log(`제목: ${course.title}\n`);
  course.stops.forEach((s, i) => {
    console.log(`${i + 1}. [${s.time}] ${s.place}`);
    console.log(`   ${s.address}`);
    console.log(`   ${s.activity}`);
    console.log(`   → ${s.why}\n`);
  });
  console.log('팁:');
  course.tips.forEach((t) => console.log(` - ${t}`));
  console.log(`\n토큰: 입력 ${usage.inputTokens} / 출력 ${usage.outputTokens}`);
  await closeDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
