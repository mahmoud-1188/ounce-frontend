import { KIND_TO_PAGE } from "../core/navigation.js";

const scopeIndex = (index, scope) =>
  (index || []).filter((r) => {
    const page = KIND_TO_PAGE[r.kind];
    return !page || scope.has(page);
  });

export { scopeIndex };
