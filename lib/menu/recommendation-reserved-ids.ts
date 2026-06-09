import type { RecommendationRuleDraft } from '@/components/dashboard/menu-manager/recommendation-rule-form';
import type { MenuItemRow } from '@/components/dashboard/menu-manager/types';

import {
  RECOMMENDATION_FORM_VARIANTS,
  type RecommendationFormVariant,
} from '@/lib/menu/recommendation-preview-groups';

function linkedProductIdsFromDraft(draft: RecommendationRuleDraft): string[] {
  if (draft.linkedProductIds.length > 0) return draft.linkedProductIds;
  if (draft.linkedProductId) return [draft.linkedProductId];
  return [];
}

/** Categories already saved or picked in other recommendation sections. */
export function reservedRecommendationCategoryIds(
  selected: MenuItemRow,
  draftByVariant: Partial<
    Record<RecommendationFormVariant, RecommendationRuleDraft>
  >,
  excludeVariant?: RecommendationFormVariant
): Set<string> {
  const ids = new Set<string>();
  for (const group of selected.attributeGroups) {
    if (group.linkedCategory) ids.add(group.linkedCategory.id);
  }
  for (const variant of RECOMMENDATION_FORM_VARIANTS) {
    if (variant === excludeVariant) continue;
    const draft = draftByVariant[variant];
    if (!draft || draft.sourceType !== 'CATEGORY') continue;
    for (const id of draft.ruleCategoryIds) ids.add(id);
  }
  return ids;
}

/** Products already saved or picked in other recommendation sections. */
export function reservedRecommendationProductIds(
  selected: MenuItemRow,
  draftByVariant: Partial<
    Record<RecommendationFormVariant, RecommendationRuleDraft>
  >,
  excludeVariant?: RecommendationFormVariant
): Set<string> {
  const ids = new Set<string>([selected.id]);
  for (const group of selected.attributeGroups) {
    if (group.linkedProduct) ids.add(group.linkedProduct.id);
  }
  for (const variant of RECOMMENDATION_FORM_VARIANTS) {
    if (variant === excludeVariant) continue;
    const draft = draftByVariant[variant];
    if (!draft || draft.sourceType !== 'PRODUCT') continue;
    for (const id of linkedProductIdsFromDraft(draft)) ids.add(id);
  }
  return ids;
}

export function findDuplicateRecommendationAssignments(
  selected: MenuItemRow,
  draftByVariant: Partial<
    Record<RecommendationFormVariant, RecommendationRuleDraft>
  >
): string | null {
  const categoryOwners = new Map<string, string>();
  for (const group of selected.attributeGroups) {
    if (group.linkedCategory) {
      categoryOwners.set(
        group.linkedCategory.id,
        `saved rule "${group.name}"`
      );
    }
  }

  const productOwners = new Map<string, string>();
  for (const group of selected.attributeGroups) {
    if (group.linkedProduct) {
      productOwners.set(
        group.linkedProduct.id,
        `saved rule "${group.name}"`
      );
    }
  }

  for (const variant of RECOMMENDATION_FORM_VARIANTS) {
    const draft = draftByVariant[variant];
    if (!draft) continue;
    const label = variant.replace('-', ' · ');

    if (draft.sourceType === 'CATEGORY') {
      for (const catId of draft.ruleCategoryIds) {
        const existing = categoryOwners.get(catId);
        if (existing) {
          return `Category is already used in ${existing} and ${label}.`;
        }
        categoryOwners.set(catId, label);
      }
    } else {
      for (const productId of linkedProductIdsFromDraft(draft)) {
        const existing = productOwners.get(productId);
        if (existing) {
          return `Product is already used in ${existing} and ${label}.`;
        }
        productOwners.set(productId, label);
      }
    }
  }

  return null;
}
