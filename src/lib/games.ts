import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

export interface GameFilters {
    categoryIds?: number[];
    publisherIds?: number[];
    categoryId?: number | null;
    publisherId?: number | null;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function normalizeIdList(values?: number[] | number | null): number[] {
    const rawValues = Array.isArray(values)
        ? values
        : values === undefined || values === null
          ? []
          : [values];

    return [...new Set(rawValues.filter((value): value is number => Number.isInteger(value) && value > 0))];
}

function resolveCategoryIds(filters: GameFilters): number[] {
    if (filters.categoryIds?.length) {
        return normalizeIdList(filters.categoryIds);
    }

    return normalizeIdList(filters.categoryId ?? null);
}

function resolvePublisherIds(filters: GameFilters): number[] {
    if (filters.publisherIds?.length) {
        return normalizeIdList(filters.publisherIds);
    }

    return normalizeIdList(filters.publisherId ?? null);
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All games ordered by title, optionally filtered by category and/or publisher. */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const categoryIds = resolveCategoryIds(filters);
    const publisherIds = resolvePublisherIds(filters);
    let query = baseGamesQuery(db);

    const clauses = [];
    if (categoryIds.length > 0) {
        clauses.push(inArray(categories.id, categoryIds));
    }
    if (publisherIds.length > 0) {
        clauses.push(inArray(publishers.id, publisherIds));
    }

    if (clauses.length > 0) {
        query = query.where(and(...clauses));
    }

    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All games for a specific category or category set. */
export async function getGamesByCategory(db: Database, categoryIds: number | number[]): Promise<Game[]> {
    return getAllGames(db, { categoryIds: normalizeIdList(categoryIds) });
}

/** All games for a specific publisher or publisher set. */
export async function getGamesByPublisher(db: Database, publisherIds: number | number[]): Promise<Game[]> {
    return getAllGames(db, { publisherIds: normalizeIdList(publisherIds) });
}

/** Alias for getAllGames to support filter-aware helper usage. */
export async function getFilteredGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    return getAllGames(db, filters);
}

/** All game ids ordered by title, optionally filtered by category and/or publisher. */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const categoryIds = resolveCategoryIds(filters);
    const publisherIds = resolvePublisherIds(filters);
    let query = db
        .select({ id: games.id })
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));

    const clauses = [];
    if (categoryIds.length > 0) {
        clauses.push(inArray(categories.id, categoryIds));
    }
    if (publisherIds.length > 0) {
        clauses.push(inArray(publishers.id, publisherIds));
    }

    if (clauses.length > 0) {
        query = query.where(and(...clauses));
    }

    const rows = await query.orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
