import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type Comment,
  type Poll,
  type Post,
  type PostCategory,
  type User,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { Chip, ErrorText, Panel } from '../components/ui-kit';

const MAX_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;
const MAX_OPTION_LENGTH = 40;
const MAX_OPTIONS = 5;

export function Community() {
  const { user } = useAuth();
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { items } = await api.posts();
      setItems(items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  /** 글 하나만 갈아끼운다 — 투표나 댓글이 바뀌어도 목록 전체를 다시 불러오지 않는다. */
  const patch = (id: string, fn: (p: Post) => Post) =>
    setItems((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));

  /** 새 글은 공지 아래에 넣는다. 그냥 맨 앞에 붙이면 공지를 밀어낸다. */
  const insert = (post: Post) =>
    setItems((prev) => {
      const pinned = prev.filter((p) => p.category === '공지');
      const rest = prev.filter((p) => p.category !== '공지');
      return post.category === '공지' ? [post, ...pinned, ...rest] : [...pinned, post, ...rest];
    });

  const removePost = async (id: string) => {
    setError('');
    try {
      await api.deletePost(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제하지 못했습니다.');
    }
  };

  if (!user) return null;

  return (
    <Panel title={`커뮤니티 (${items.length})`}>
      <div className="mb-3 flex items-center gap-2">
        <Chip onClick={() => void load()}>새로고침</Chip>
        <span className="legend text-chrome-indigo">새 글과 댓글을 확인합니다</span>
      </div>

      <ErrorText>{error}</ErrorText>

      <Composer user={user} setError={setError} onCreated={insert} />

      {loading ? (
        <p className="legend text-chrome-indigo">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-chrome-indigo">아직 글이 없습니다. 첫 글을 남겨보세요.</p>
      ) : (
        <ul>
          {items.map((p) => (
            <li
              key={p.id}
              className={`inset mb-2 p-3 ${p.category === '공지' ? 'border-l-4 border-l-brand-red' : ''}`}
            >
              <div className="mb-1 flex items-baseline gap-2">
                {p.category === '공지' && (
                  <span className="chip bg-brand-red px-2 py-0.5 legend text-white">공지</span>
                )}
                <span className="text-[12px] font-bold text-carbon">{p.name}님</span>
                <span className="text-[10px] text-muted-indigo">{ago(p.createdAt)}</span>
                {owns(user, p.userId) && (
                  <button
                    onClick={() => void removePost(p.id)}
                    className="ml-auto text-[10px] text-chrome-indigo underline hover:text-brand-red"
                  >
                    삭제
                  </button>
                )}
              </div>

              <p className="whitespace-pre-wrap break-words text-[12px] text-carbon">{p.body}</p>

              {p.poll && (
                <PollBox
                  poll={p.poll}
                  setError={setError}
                  onVoted={(poll) => patch(p.id, (q) => ({ ...q, poll }))}
                  submit={(optionId) => api.vote(p.id, optionId)}
                />
              )}

              <Comments post={p} user={user} patch={patch} setError={setError} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Composer({
  user,
  onCreated,
  setError,
}: {
  user: User;
  onCreated: (post: Post) => void;
  setError: (m: string) => void;
}) {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory>('일반');
  const [options, setOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setError('');
    setBusy(true);
    try {
      const picked = options?.map((o) => o.trim()).filter(Boolean);
      const { post } = await api.writePost(body, picked, category);
      onCreated(post);
      setBody('');
      setOptions(null);
      setCategory('일반');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '글을 올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const setOption = (i: number, value: string) =>
    setOptions((prev) => prev?.map((o, idx) => (idx === i ? value : o)) ?? null);

  return (
    <div className="inset mb-4 p-2">
      <textarea
        rows={3}
        value={body}
        maxLength={MAX_LENGTH}
        placeholder="6기 1반에게 하고 싶은 말을 남겨보세요"
        onChange={(e) => setBody(e.target.value)}
        className="w-full text-[12px] text-carbon outline-none"
      />

      {options && (
        <div className="mb-2">
          <p className="legend mb-1 text-chrome-indigo">투표 선택지</p>
          {options.map((o, i) => (
            <div key={i} className="mb-1 flex gap-2">
              <input
                value={o}
                maxLength={MAX_OPTION_LENGTH}
                placeholder={`선택지 ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)}
                className="min-h-9 flex-1 border border-chrome-indigo bg-white px-2 text-[12px] text-carbon outline-none"
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  className="text-[10px] text-chrome-indigo underline hover:text-brand-red"
                >
                  빼기
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button
              onClick={() => setOptions([...options, ''])}
              className="text-[11px] text-chrome-indigo underline"
            >
              선택지 추가
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Chip variant="signal" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? '올리는 중' : '글 올리기'}
        </Chip>

        <button
          onClick={() => setOptions(options ? null : ['', ''])}
          className="text-[11px] text-chrome-indigo underline"
        >
          {options ? '투표 빼기' : '투표 넣기'}
        </button>

        {/* 공지는 어드민만, 그리고 글을 쓸 때만 정할 수 있다 */}
        {user.role === 'admin' && (
          <label className="flex items-center gap-1 text-[11px] text-carbon">
            <input
              type="checkbox"
              checked={category === '공지'}
              onChange={(e) => setCategory(e.target.checked ? '공지' : '일반')}
            />
            공지로 등록
          </label>
        )}

        <span className="legend ml-auto text-muted-indigo">
          {body.length} / {MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}

/**
 * 투표하기 → 선택지 고르기 → 완료.
 * 막대를 바로 누르면 실수로 표가 들어가서, 확인 단계를 한 번 둔다.
 */
function PollBox({
  poll,
  onVoted,
  submit,
  setError,
}: {
  poll: Poll;
  onVoted: (poll: Poll) => void;
  submit: (optionId: string) => Promise<{ poll: Poll }>;
  setError: (m: string) => void;
}) {
  const [voting, setVoting] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setPicked(poll.myVote);
    setVoting(true);
  };

  const done = async () => {
    if (!picked) return;
    setError('');
    setBusy(true);
    try {
      const { poll: updated } = await submit(picked);
      onVoted(updated);
      setVoting(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '투표하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (voting) {
    return (
      <div className="mt-2 border border-chrome-indigo p-2">
        <p className="legend mb-1 text-chrome-indigo">선택지를 고르고 완료를 누르세요</p>
        {poll.options.map((o) => (
          <label
            key={o.id}
            className="mb-1 flex cursor-pointer items-center gap-2 bg-white px-2 py-1.5 text-[12px] text-carbon"
          >
            <input
              type="radio"
              checked={picked === o.id}
              onChange={() => setPicked(o.id)}
            />
            {o.label}
          </label>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <Chip variant="signal" onClick={done} disabled={busy || !picked}>
            {busy ? '반영 중' : '완료'}
          </Chip>
          <button
            onClick={() => setVoting(false)}
            className="text-[11px] text-chrome-indigo underline"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {poll.options.map((o) => {
        const percent = poll.total === 0 ? 0 : Math.round((o.count / poll.total) * 100);
        return (
          <div key={o.id} className="progress-track relative mb-1 block h-6">
            <span className="progress-fill block" style={{ width: `${percent}%` }} />
            <span className="absolute inset-0 flex items-center gap-2 px-2">
              <span className="text-[11px] font-bold text-carbon">
                {poll.myVote === o.id ? '✓ ' : ''}
                {o.label}
              </span>
              <span className="ml-auto text-[10px] text-carbon">
                {o.count}표 · {percent}%
              </span>
            </span>
          </div>
        );
      })}
      <div className="mt-1 flex items-center gap-2">
        <Chip onClick={start}>{poll.myVote ? '다시 투표하기' : '투표하기'}</Chip>
        <span className="legend text-muted-indigo">총 {poll.total}표</span>
      </div>
    </div>
  );
}

function Comments({
  post,
  user,
  patch,
  setError,
}: {
  post: Post;
  user: User;
  patch: (id: string, fn: (p: Post) => Post) => void;
  setError: (m: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    setError('');
    setBusy(true);
    try {
      const { comment } = await api.writeComment(post.id, text);
      patch(post.id, (p) => ({ ...p, comments: [...p.comments, comment] }));
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 올리지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Comment) => {
    setError('');
    try {
      await api.deleteComment(post.id, c.id);
      patch(post.id, (p) => ({ ...p, comments: p.comments.filter((x) => x.id !== c.id) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제하지 못했습니다.');
    }
  };

  return (
    <div className="mt-2 border-t border-t-periwinkle pt-2">
      {post.comments.map((c) => (
        <div
          key={c.id}
          className="mb-1 flex items-baseline gap-2 border-l-2 border-chrome-indigo pl-2"
        >
          <span className="shrink-0 text-[11px] font-bold text-chrome-indigo">{c.name}님</span>
          <span className="flex-1 whitespace-pre-wrap break-words text-[12px] text-carbon">
            {c.body}
          </span>
          <span className="shrink-0 text-[10px] text-muted-indigo">{ago(c.createdAt)}</span>
          {owns(user, c.userId) && (
            <button
              onClick={() => void remove(c)}
              className="shrink-0 text-[10px] text-chrome-indigo underline hover:text-brand-red"
            >
              삭제
            </button>
          )}
        </div>
      ))}

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="댓글 달기"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
          className="min-h-9 flex-1 bg-white px-2 text-[12px] text-carbon outline-none"
        />
        <button
          onClick={add}
          disabled={busy || !text.trim()}
          className="chip legend min-h-9 shrink-0 bg-amber px-3 text-carbon disabled:opacity-50"
        >
          {busy ? '등록 중' : '등록'}
        </button>
      </div>
    </div>
  );
}

/** 본인 글이거나 어드민이면 지울 수 있다. */
const owns = (user: User, authorId: string) => user.studentNo === authorId || user.role === 'admin';

/** 방금 / N분 전 / N시간 전 / 날짜 */
function ago(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return '방금';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
