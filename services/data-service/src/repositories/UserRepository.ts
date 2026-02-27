import DataLoader from 'dataloader';
import { randomUUID } from 'crypto';
import { client } from '../db/client';
import { User } from '../types/db';

export class UserRepository {
  private userLoader: DataLoader<string, User | null>;

  constructor() {
    this.userLoader = new DataLoader<string, User | null>(
      async (userIds: readonly string[]) => {
        const query =
          'SELECT user_id, username, email, password_hash, created_at FROM users WHERE user_id IN ?';
        const result = await client.execute(query, [[...userIds]], { prepare: true });

        const byId = new Map<string, User>();
        for (const row of result.rows) {
          byId.set(row.user_id.toString(), {
            user_id: row.user_id.toString(),
            username: row.username as string,
            email: row.email as string,
            password_hash: row.password_hash as string,
            created_at: row.created_at as Date,
          });
        }
        return userIds.map((id) => byId.get(id) ?? null);
      },
      { cache: false },
    );
  }

  async batchGetById(ids: string[]): Promise<(User | null)[]> {
    const results = await this.userLoader.loadMany(ids);
    return results.map(r => { if (r instanceof Error) throw r; return r; });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT user_id FROM users_by_email WHERE email = ?';
    const result = await client.execute(query, [email], { prepare: true });
    if (result.rows.length === 0) return null;
    const userId = result.rows[0].user_id.toString();
    return this.userLoader.load(userId);
  }

  async createUser(data: { username: string; email: string; passwordHash: string }): Promise<User> {
    const { username, email, passwordHash } = data;
    const userId = randomUUID();
    const createdAt = new Date();

    // Write to primary table
    const insertUser =
      'INSERT INTO users (user_id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)';
    await client.execute(insertUser, [userId, username, email, passwordHash, createdAt], {
      prepare: true,
    });

    // Write to email lookup table
    const insertByEmail = 'INSERT INTO users_by_email (email, user_id) VALUES (?, ?)';
    await client.execute(insertByEmail, [email, userId], { prepare: true });

    return { user_id: userId, username, email, password_hash: passwordHash, created_at: createdAt };
  }
}
