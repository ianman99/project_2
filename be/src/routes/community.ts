import { Router } from 'express';
import type { Request } from 'express';
import { ObjectId } from 'mongodb';
import { posts, students } from '../db/collections';
import { HttpError } from '../lib/http-error';
import { currentStudentNo, requireAuth } from '../middleware/require-auth';
import { POST_CATEGORIES } from '../types/models';
import type { CommentDoc, PollDoc, PostCategory, PostDoc } from '../types/models';

export const communityRouter = Router();

communityRouter.use(requireAuth);

/** 한 번에 내려보낼 글 수. 상세 페이지가 없으니 목록이 곧 전부다. */
const LIMIT = 100;
const MAX_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;
const MAX_OPTION_LENGTH = 40;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

const isAdmin = (req: Request) => req.session.role === 'admin';
const isNotice = (doc: PostDoc) => doc.category === '공지';

/** 본문을 다듬고 길이를 검사한다. */
function cleanBody(raw: unknown, max: number): string {
  const body = String((raw as { body?: unknown })?.body ?? '').trim();
  if (!body) throw new HttpError(400, 'empty_body', '내용을 입력해 주세요.');
  if (body.length > max) throw new HttpError(400, 'too_long', `${max}자까지 쓸 수 있습니다.`);
  return body;
}

/** 어드민이 아니면 남의 것을 건드릴 수 없다. */
const ownerFilter = (req: Request, userId: string) => (isAdmin(req) ? {} : { userId });

/**
 * 카테고리는 글을 쓸 때 한 번만 정하고 이후 바꿀 수 없다.
 * '공지'는 어드민만 붙일 수 있고, 나머지는 전부 '일반'이다.
 */
function parseCategory(raw: unknown, admin: boolean): PostCategory {
  if (raw === null || raw === undefined || raw === '') return '일반';
  const value = String(raw);
  if (!(POST_CATEGORIES as readonly string[]).includes(value)) {
    throw new HttpError(400, 'invalid_category', '알 수 없는 카테고리입니다.');
  }
  if (value === '공지' && !admin) {
    throw new HttpError(403, 'admin_only', '공지는 어드민만 등록할 수 있습니다.');
  }
  return value as PostCategory;
}

/** 투표 선택지. 안 보내면 투표 없는 일반 글이다. */
function parsePoll(raw: unknown): PollDoc | null {
  if (!Array.isArray(raw)) return null;

  const labels = raw.map((o) => String(o ?? '').trim()).filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length < MIN_OPTIONS || labels.length > MAX_OPTIONS) {
    throw new HttpError(400, 'invalid_poll', `선택지는 ${MIN_OPTIONS}~${MAX_OPTIONS}개여야 합니다.`);
  }
  if (labels.some((l) => l.length > MAX_OPTION_LENGTH)) {
    throw new HttpError(400, 'invalid_poll', `선택지는 ${MAX_OPTION_LENGTH}자까지 쓸 수 있습니다.`);
  }

  return {
    options: labels.map((label) => ({ id: new ObjectId().toHexString(), label })),
    votes: {},
  };
}

const toPublicComment = (c: CommentDoc) => ({
  id: c._id.toHexString(),
  userId: c.userId,
  name: c.name,
  body: c.body,
  createdAt: c.createdAt,
});

/** 누가 무엇에 투표했는지는 내보내지 않는다. 집계와 본인 표만 준다. */
function toPublicPoll(poll: PollDoc | null, userId: string) {
  if (!poll) return null;
  const votes = Object.values(poll.votes ?? {});
  return {
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      count: votes.filter((v) => v === o.id).length,
    })),
    total: votes.length,
    myVote: poll.votes?.[userId] ?? null,
  };
}

const toPublic = (doc: PostDoc, userId: string) => ({
  id: doc._id.toHexString(),
  userId: doc.userId,
  name: doc.name,
  body: doc.body,
  createdAt: doc.createdAt,
  category: doc.category ?? '일반',
  poll: toPublicPoll(doc.poll ?? null, userId),
  // 댓글은 단 순서대로 — 글과 반대 방향이다.
  comments: (doc.comments ?? []).map(toPublicComment),
});

/** 공지가 맨 위, 나머지는 최신순. */
communityRouter.get('/', async (req, res) => {
  const userId = currentStudentNo(req);
  const items = await posts().find({}).sort({ createdAt: -1 }).limit(LIMIT).toArray();
  const ordered = [...items.filter(isNotice), ...items.filter((p) => !isNotice(p))];
  res.json({ categories: POST_CATEGORIES, items: ordered.map((p) => toPublic(p, userId)) });
});

communityRouter.post('/', async (req, res) => {
  const userId = currentStudentNo(req);
  const body = cleanBody(req.body, MAX_LENGTH);
  const { pollOptions, category } = (req.body ?? {}) as Record<string, unknown>;

  const student = await students().findOne({ _id: userId }, { projection: { name: 1 } });
  const doc: PostDoc = {
    _id: new ObjectId(),
    userId,
    name: student?.name ?? userId,
    body,
    createdAt: new Date(),
    comments: [],
    category: parseCategory(category, isAdmin(req)),
    poll: parsePoll(pollOptions),
  };
  await posts().insertOne(doc);
  res.status(201).json({ post: toPublic(doc, userId) });
});

/** 투표. 화면에서 선택지를 고르고 완료를 눌러야 여기까지 온다. 다시 투표하면 표가 옮겨간다. */
communityRouter.post('/:id/vote', async (req, res) => {
  const userId = currentStudentNo(req);
  if (!ObjectId.isValid(req.params.id)) {
    throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  }

  const _id = new ObjectId(req.params.id);
  const doc = await posts().findOne({ _id });
  if (!doc?.poll) throw new HttpError(404, 'no_poll', '투표가 없는 글입니다.');

  const optionId = String((req.body as { optionId?: unknown })?.optionId ?? '');
  if (!doc.poll.options.some((o) => o.id === optionId)) {
    throw new HttpError(400, 'invalid_option', '없는 선택지입니다.');
  }

  const updated = await posts().findOneAndUpdate(
    { _id },
    { $set: { [`poll.votes.${userId}`]: optionId } },
    { returnDocument: 'after' },
  );
  res.json({ poll: toPublicPoll(updated?.poll ?? null, userId) });
});

communityRouter.delete('/:id', async (req, res) => {
  const userId = currentStudentNo(req);
  if (!ObjectId.isValid(req.params.id)) {
    throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  }

  // 글을 지우면 달린 댓글도 함께 사라진다 (같은 문서 안에 있다).
  const result = await posts().deleteOne({
    _id: new ObjectId(req.params.id),
    ...ownerFilter(req, userId),
  });
  if (result.deletedCount === 0) {
    throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  }
  res.json({ ok: true });
});

communityRouter.post('/:id/comments', async (req, res) => {
  const userId = currentStudentNo(req);
  const body = cleanBody(req.body, MAX_COMMENT_LENGTH);
  if (!ObjectId.isValid(req.params.id)) {
    throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  }

  const student = await students().findOne({ _id: userId }, { projection: { name: 1 } });
  const comment: CommentDoc = {
    _id: new ObjectId(),
    userId,
    name: student?.name ?? userId,
    body,
    createdAt: new Date(),
  };

  const result = await posts().updateOne(
    { _id: new ObjectId(req.params.id) },
    { $push: { comments: comment } },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(404, 'not_found', '글을 찾을 수 없습니다.');
  }
  res.status(201).json({ comment: toPublicComment(comment) });
});

communityRouter.delete('/:id/comments/:commentId', async (req, res) => {
  const userId = currentStudentNo(req);
  const { id, commentId } = req.params;
  if (!ObjectId.isValid(id) || !ObjectId.isValid(commentId)) {
    throw new HttpError(404, 'not_found', '댓글을 찾을 수 없습니다.');
  }

  const result = await posts().updateOne(
    { _id: new ObjectId(id) },
    { $pull: { comments: { _id: new ObjectId(commentId), ...ownerFilter(req, userId) } } },
  );
  if (result.modifiedCount === 0) {
    throw new HttpError(404, 'not_found', '댓글을 찾을 수 없습니다.');
  }
  res.json({ ok: true });
});
