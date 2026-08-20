import type { MatchProgress } from '../lib/api';

/** 회전 스피너 + 단계 라벨 + 진행 바. */
export function Progress({ progress }: { progress: MatchProgress }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="spinner shrink-0" />
        <span className="text-[12px] font-bold text-carbon">{progress.label}</span>
      </div>

      <div className="progress-track mb-1">
        <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="flex justify-between text-[10px] text-chrome-indigo">
        <span>{progress.percent}%</span>
        <span>{Math.round(progress.elapsedMs / 1000)}초 경과</span>
      </div>

      <p className="mt-2 text-[10px] text-muted-indigo">
        진행률은 평균 소요 시간 기준 추정치입니다. 다른 화면에 다녀와도 계속 진행됩니다.
      </p>
    </div>
  );
}
