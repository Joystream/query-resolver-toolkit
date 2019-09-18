import { Context, Resolver, FieldFilter, console } from "joystream/query"
import { Struct } from "joystream/query/codec"
import { Map, Plain } from "joystream/query/storage"

export type CategoryId = u32

export class Category extends Struct {
    public static Codec(): string {
        return `{"id": "CategoryId", "title": "Text", "description": "Text", "deleted": "Bool", "archived": "Bool"}`
    }
}

export type ThreadId = u32

export class Thread extends Struct {
    public static Codec(): string {
		return `{"id": "ThreadId", "title": "Text", "category_id": "CategoryId", "nr_in_category": "U32"}`
    }
}

export const NextCategoryId = new Plain<CategoryId>("forum", "nextCategoryId")
export const CategoryById = new Map<CategoryId, Category>("forum", "CategoryById")

export const NextThreadId = new Plain<ThreadId>("forum", "nextThreadId")
export const ThreadById = new Map<ThreadId, Thread>("forum", "ThreadById")

const CategoryIdFilter = new FieldFilter<CategoryId>("category_id")

export class CategoryList extends Resolver {
    constructor() {
        super(["start: Int = 1"], "[Category]")
    }

    public resolve(ctx: Context): void {
        NextCategoryId.fetch(ctx, (ctx: Context, nextId: CategoryId) => {
            const batch = CategoryById.batch()

            for (let i: CategoryId = ctx.mustParam<CategoryId>("start"); i < nextId; i++) {
                batch.add(i)
            }

            batch.fetch(ctx, (ctx: Context, category: Category) => {
                ctx.produce.json(category.JSON)
            })
        })
    }
}


export class ThreadList extends Resolver {
    constructor() {
        super(
			[
				"start: Int = 1",
				"category: Int = 0", //FIXME: `any` type
			], 
			"[Thread]")
    }

    public resolve(ctx: Context): void {
        NextThreadId.fetch(ctx, (ctx: Context, nextId: ThreadId) => {
            const batch = ThreadById.batch()

            for (let i: ThreadId = ctx.param<ThreadId>("start"); i < nextId; i++) {
                batch.add(i)
            }

            batch.fetch(ctx, (ctx: Context, thread: Thread) => {
				// Get category ID from parent or args.
				// This is rather limited at the momebt, because
				// we don't check for maximum counts in the category
				// itself, and we should.
				const categoryId = ctx.select<CategoryId>([
					ctx.param<CategoryId>("id", ctx.parentIfSet()),
					ctx.param<CategoryId>("catregory"),
				])
				
				if (categoryId == null) {
					ctx.produce.json(thread.JSON)
				} else {
					CategoryIdFilter.apply(
						ctx, 
						categoryId,
						thread.JSON,
					)
				}
            })
        })
    }
}
