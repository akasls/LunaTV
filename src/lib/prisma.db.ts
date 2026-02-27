import { PrismaClient } from '@prisma/client';

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class PrismaStorage implements IStorage {
  private async ensureUser(username: string) {
    if (!username) return;
    try {
      await prisma.user.upsert({
        where: { username },
        update: {},
        create: { username, password: '' },
      });
    } catch (e) {
      // ignore
    }
  }

  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    const record = await prisma.playRecord.findUnique({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
    });
    if (!record) return null;
    return {
      title: record.title,
      source_name: record.sourceName,
      cover: record.cover,
      year: record.year,
      index: record.index,
      total_episodes: record.totalEpisodes,
      play_time: record.playTime,
      total_time: record.totalTime,
      save_time: record.saveTime,
      search_title: record.searchTitle,
    };
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    await this.ensureUser(userName);
    await prisma.playRecord.upsert({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
      update: {
        sourceName: record.source_name,
        title: record.title,
        cover: record.cover,
        year: record.year,
        index: record.index,
        totalEpisodes: record.total_episodes,
        playTime: record.play_time,
        totalTime: record.total_time,
        saveTime: record.save_time,
        searchTitle: record.search_title,
      },
      create: {
        username: userName,
        key,
        sourceName: record.source_name,
        title: record.title,
        cover: record.cover,
        year: record.year,
        index: record.index,
        totalEpisodes: record.total_episodes,
        playTime: record.play_time,
        totalTime: record.total_time,
        saveTime: record.save_time,
        searchTitle: record.search_title,
      },
    });
  }

  async getAllPlayRecords(userName: string): Promise<{ [key: string]: PlayRecord }> {
    const records = await prisma.playRecord.findMany({
      where: { username: userName },
    });
    const result: { [key: string]: PlayRecord } = {};
    for (const record of records) {
      result[record.key] = {
        title: record.title,
        source_name: record.sourceName,
        cover: record.cover,
        year: record.year,
        index: record.index,
        total_episodes: record.totalEpisodes,
        play_time: record.playTime,
        total_time: record.totalTime,
        save_time: record.saveTime,
        search_title: record.searchTitle,
      };
    }
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    try {
      await prisma.playRecord.delete({
        where: {
          username_key: {
            username: userName,
            key,
          },
        },
      });
    } catch (e) { /* ignore */ }
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const fav = await prisma.favorite.findUnique({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
    });
    if (!fav) return null;
    return {
      source_name: fav.sourceName,
      total_episodes: fav.totalEpisodes,
      title: fav.title,
      year: fav.year,
      cover: fav.cover,
      save_time: fav.saveTime,
      search_title: fav.searchTitle,
      origin: fav.origin as 'vod' | 'live' | undefined,
    };
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    await this.ensureUser(userName);
    await prisma.favorite.upsert({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
      update: {
        sourceName: favorite.source_name,
        totalEpisodes: favorite.total_episodes,
        title: favorite.title,
        year: favorite.year,
        cover: favorite.cover,
        saveTime: favorite.save_time,
        searchTitle: favorite.search_title,
        origin: favorite.origin,
      },
      create: {
        username: userName,
        key,
        sourceName: favorite.source_name,
        totalEpisodes: favorite.total_episodes,
        title: favorite.title,
        year: favorite.year,
        cover: favorite.cover,
        saveTime: favorite.save_time,
        searchTitle: favorite.search_title,
        origin: favorite.origin,
      },
    });
  }

  async getAllFavorites(userName: string): Promise<{ [key: string]: Favorite }> {
    const favs = await prisma.favorite.findMany({
      where: { username: userName },
    });
    const result: { [key: string]: Favorite } = {};
    for (const fav of favs) {
      result[fav.key] = {
        source_name: fav.sourceName,
        total_episodes: fav.totalEpisodes,
        title: fav.title,
        year: fav.year,
        cover: fav.cover,
        save_time: fav.saveTime,
        search_title: fav.searchTitle,
        origin: fav.origin as 'vod' | 'live' | undefined,
      };
    }
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    try {
      await prisma.favorite.delete({
        where: {
          username_key: {
            username: userName,
            key,
          },
        },
      });
    } catch (e) { /* ignore */ }
  }

  async registerUser(userName: string, passwordHash: string): Promise<void> {
    await prisma.user.upsert({
      where: { username: userName },
      update: { password: passwordHash },
      create: { username: userName, password: passwordHash },
    });
  }

  async verifyUser(userName: string, passwordHash: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { username: userName },
    });
    return user?.password === passwordHash;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { username: userName },
    });
    return !!user;
  }

  async changePassword(userName: string, newPasswordHash: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { username: userName },
        data: { password: newPasswordHash },
      });
    } catch (e) { /* ignore */ }
  }

  async deleteUser(userName: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { username: userName },
      });
    } catch (e) { /* ignore */ }
  }

  async getAllUsers(): Promise<string[]> {
    const users = await prisma.user.findMany({ select: { username: true } });
    return users.map((u) => u.username);
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const histories = await prisma.searchHistory.findMany({
      where: { username: userName },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return histories.map((h) => h.keyword);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    await this.ensureUser(userName);
    await prisma.searchHistory.upsert({
      where: {
        username_keyword: {
          username: userName,
          keyword,
        },
      },
      update: {},
      create: {
        username: userName,
        keyword,
      },
    });

    const all = await prisma.searchHistory.findMany({
      where: { username: userName },
      orderBy: { updatedAt: 'desc' },
    });
    if (all.length > 20) {
      const toDelete = all.slice(20).map((h) => h.id);
      await prisma.searchHistory.deleteMany({
        where: { id: { in: toDelete } },
      });
    }
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (keyword) {
      try {
        await prisma.searchHistory.delete({
          where: {
            username_keyword: {
              username: userName,
              keyword,
            },
          },
        });
      } catch (e) { /* ignore */ }
    } else {
      await prisma.searchHistory.deleteMany({
        where: { username: userName },
      });
    }
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const record = await prisma.globalConfig.findUnique({
      where: { key: 'admin_config' },
    });
    if (!record || !record.value) return null;
    try {
      return JSON.parse(record.value) as AdminConfig;
    } catch (e) {
      return null;
    }
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    await prisma.globalConfig.upsert({
      where: { key: 'admin_config' },
      update: { value: JSON.stringify(config) },
      create: { key: 'admin_config', value: JSON.stringify(config) },
    });
  }

  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    const key = `${source}+${id}`;
    const skip = await prisma.skipConfig.findUnique({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
    });
    if (!skip) return null;
    return {
      enable: skip.enable,
      intro_time: skip.introTime,
      outro_time: skip.outroTime,
    };
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    await this.ensureUser(userName);
    const key = `${source}+${id}`;
    await prisma.skipConfig.upsert({
      where: {
        username_key: {
          username: userName,
          key,
        },
      },
      update: {
        enable: config.enable,
        introTime: config.intro_time,
        outroTime: config.outro_time,
      },
      create: {
        username: userName,
        key,
        enable: config.enable,
        introTime: config.intro_time,
        outroTime: config.outro_time,
      },
    });
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    const key = `${source}+${id}`;
    try {
      await prisma.skipConfig.delete({
        where: {
          username_key: {
            username: userName,
            key,
          },
        },
      });
    } catch (e) { /* ignore */ }
  }

  async getAllSkipConfigs(userName: string): Promise<{ [key: string]: SkipConfig }> {
    const skips = await prisma.skipConfig.findMany({
      where: { username: userName },
    });
    const result: { [key: string]: SkipConfig } = {};
    for (const skip of skips) {
      result[skip.key] = {
        enable: skip.enable,
        intro_time: skip.introTime,
        outro_time: skip.outroTime,
      };
    }
    return result;
  }

  async clearAllData(): Promise<void> {
    await prisma.playRecord.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.searchHistory.deleteMany();
    await prisma.skipConfig.deleteMany();
    await prisma.user.deleteMany();
    await prisma.globalConfig.deleteMany();
  }
}
