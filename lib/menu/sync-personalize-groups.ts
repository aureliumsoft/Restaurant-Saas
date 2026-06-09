import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';

type DbClient = Prisma.TransactionClient | typeof db;

export type PersonalizeGroupInput = {
  id?: string;
  parentName: string;
  maxItems: number;
  sortOrder?: number;
  options: Array<{
    id?: string;
    name: string;
    imageUrl?: string | null;
    sortOrder?: number;
  }>;
};

export async function syncMenuItemPersonalizeGroups(
  client: DbClient,
  menuItemId: string,
  groups: PersonalizeGroupInput[]
) {
  const existing = await client.menuItemPersonalizeGroup.findMany({
    where: { menuItemId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((g) => g.id));
  const keepIds = new Set<string>();

  for (const [groupIndex, group] of groups.entries()) {
    const groupData = {
      parentName: group.parentName.trim(),
      maxItems: group.maxItems,
      sortOrder: group.sortOrder ?? groupIndex,
    };

    let groupId = group.id;
    if (groupId && existingIds.has(groupId)) {
      await client.menuItemPersonalizeGroup.update({
        where: { id: groupId },
        data: groupData,
      });
      keepIds.add(groupId);
    } else {
      const created = await client.menuItemPersonalizeGroup.create({
        data: { menuItemId, ...groupData },
      });
      groupId = created.id;
      keepIds.add(groupId);
    }

    const existingOptions = await client.menuItemPersonalizeOption.findMany({
      where: { groupId },
      select: { id: true },
    });
    const existingOptionIds = new Set(existingOptions.map((o) => o.id));
    const keepOptionIds = new Set<string>();

    for (const [optIndex, opt] of group.options.entries()) {
      const imageUrl =
        opt.imageUrl && opt.imageUrl.trim().length > 0
          ? opt.imageUrl.trim()
          : null;
      const optionData = {
        name: opt.name.trim(),
        imageUrl,
        sortOrder: opt.sortOrder ?? optIndex,
      };

      if (opt.id && existingOptionIds.has(opt.id)) {
        await client.menuItemPersonalizeOption.update({
          where: { id: opt.id },
          data: optionData,
        });
        keepOptionIds.add(opt.id);
      } else {
        const created = await client.menuItemPersonalizeOption.create({
          data: { groupId, ...optionData },
        });
        keepOptionIds.add(created.id);
      }
    }

    const removeOptionIds = [...existingOptionIds].filter(
      (id) => !keepOptionIds.has(id)
    );
    if (removeOptionIds.length > 0) {
      await client.menuItemPersonalizeOption.deleteMany({
        where: { id: { in: removeOptionIds } },
      });
    }
  }

  const removeGroupIds = [...existingIds].filter((id) => !keepIds.has(id));
  if (removeGroupIds.length > 0) {
    await client.menuItemPersonalizeGroup.deleteMany({
      where: { id: { in: removeGroupIds } },
    });
  }
}
