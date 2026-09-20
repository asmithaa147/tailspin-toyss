import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
    getGamesByCategory,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<void> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat-1' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat-2' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'pub-1' })
        .returning({ id: publishers.id });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'pub-2' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Alpha Quest', description: 'Alpha strategy', starRating: 4.5, categoryId: strategy.id, publisherId: codeForge.id },
        { title: 'Beta Quest', description: 'Beta strategy', starRating: 4.1, categoryId: strategy.id, publisherId: devMasters.id },
        { title: 'Gamma Puzzle', description: 'Gamma puzzle', starRating: 3.8, categoryId: puzzle.id, publisherId: codeForge.id },
        { title: 'Delta Puzzle', description: 'Delta puzzle', starRating: 4.0, categoryId: puzzle.id, publisherId: devMasters.id },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('returns all categories and publishers in name order', async () => {
        await seedFilteredGames(db);
        await expect(getAllCategories(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        await expect(getAllPublishers(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'CodeForge Studios' },
            { id: expect.any(Number), name: 'DevMasters Inc.' },
        ]);
    });

    it('filters games by category ids', async () => {
        await seedFilteredGames(db);
        const category = (await getAllCategories(db)).find((item) => item.name === 'Strategy');

        expect(category).toBeDefined();
        const gamesByCategory = await getGamesByCategory(db, category!.id);
        expect(gamesByCategory.map((game) => game.title)).toEqual(['Alpha Quest', 'Beta Quest']);
    });

    it('combines category and publisher filters', async () => {
        await seedFilteredGames(db);
        const strategyCategory = (await getAllCategories(db)).find((item) => item.name === 'Strategy');
        const codeForgePublisher = (await getAllPublishers(db)).find((item) => item.name === 'CodeForge Studios');

        expect(strategyCategory).toBeDefined();
        expect(codeForgePublisher).toBeDefined();

        const filteredGames = await getAllGames(db, {
            categoryIds: [strategyCategory!.id],
            publisherIds: [codeForgePublisher!.id],
        });

        expect(filteredGames.map((game) => game.title)).toEqual(['Alpha Quest']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
