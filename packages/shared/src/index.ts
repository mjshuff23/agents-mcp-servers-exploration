export * from './types.js';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function recipePromptName(recipeIdOrName: string): string {
  return `recipe.${slugify(recipeIdOrName)}`;
}

export function recipeToPromptDescriptor(recipe: import('./types.js').AgentRecipe): import('./types.js').RecipePromptDescriptor {
  return {
    name: recipePromptName(recipe.id || recipe.name),
    title: `${recipe.name} Recipe`,
    description: recipe.description
  };
}

export function filePathToResourceUri(path: string): string {
  return `workspace://file/${encodeURIComponent(path)}`;
}
