import type { TagCount, TagsResponse } from '@cairn/core';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from 'mongodb';
import type { Auth } from '../auth/auth';
import { protectRoutes } from '../auth/require-user';
import { notesCollection } from '../notes/model';

const TAGS_MAX = 200;

export const tagRoutes: FastifyPluginAsync<{ db: Db; auth: Auth }> = async (app, { db, auth }) => {
  const notes = notesCollection(db);
  protectRoutes(app, auth);

  app.get('/', async (request): Promise<TagsResponse> => {
    // Counts across all of the user's notes on every call. Cheap for a personal vault; at
    // tens of thousands of notes, keep running counts instead.
    const tags = await notes
      .aggregate<TagCount>([
        { $match: { userId: request.userId } },
        { $project: { tags: 1 } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TAGS_MAX },
        { $project: { _id: 0, tag: '$_id', count: 1 } },
      ])
      .toArray();
    return { tags };
  });
};
