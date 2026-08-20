import { Panel } from '../components/ui-kit';

export function Admin() {
  return (
    <>
      <Panel title="충전 요청">
        <p className="text-[11px] text-chrome-indigo">대기 중인 요청이 없습니다.</p>
      </Panel>
      <Panel title="포인트 지급">
        <p className="text-[11px] text-chrome-indigo">
          지급 기능은 PRD 7단계에서 연결됩니다.
        </p>
      </Panel>
    </>
  );
}
