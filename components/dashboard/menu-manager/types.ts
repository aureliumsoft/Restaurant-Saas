export type VariationLimitRow = {
  variationId: string;
  minItems: number;
  maxItems: number;
};

export type AttrGroupRow = {
  id: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  sourceType?: 'CATEGORY' | 'PRODUCT';
  multipleMode?: 'CHECKBOX' | 'QUANTITY' | null;
  freeQuantity?: number | null;
  required: boolean;
  minItems: number | null;
  maxItems: number | null;
  sortOrder: number;
  linkedCategory?: { id: string; name: string } | null;
  defaultLinkedMenuItemId?: string | null;
  defaultLinkedMenuItem?: {
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
  } | null;
  linkedProduct?: {
    id: string;
    name: string;
    imageUrl: string | null;
    price: number;
    salePrice: number | null;
  } | null;
  productCategoryIds?: string[];
  variationLimits?: VariationLimitRow[];
  useVariationPricing?: boolean;
};

export type RestaurantVariationRow = {
  id: string;
  name: string;
  shortLabel: string | null;
  sortOrder: number;
};

export type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  salePrice: number | null;
  categoryId: string;
  categoryIds?: string[];
  updatedAt?: string;
  createdAt?: string;
  variations?: {
    id: string;
    name?: string;
    title?: string;
    imageUrl?: string | null;
    swatchHex: string | null;
    priceDelta: number;
    sortOrder: number;
    restaurantVariationId?: string | null;
  }[];
  attributeGroups: AttrGroupRow[];
  offersFromThis?: {
    id: string;
    sortOrder: number;
    offeredItem: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: number;
      salePrice: number | null;
    };
  }[];
};

export type MenuCategoryRow = {
  id: string;
  name: string;
  imageUrl?: string | null;
  showInFront: boolean;
  items: MenuItemRow[];
};

export type RestaurantMenuData = {
  id: string;
  menus: MenuCategoryRow[];
};
