import { Context, Resolver, FieldFilter } from "joystream/query"
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
				"category: Int = 0", 
				"start: Int = 1", 
			], 
			"[Thread]")
	}

	public resolve(ctx: Context): void {
		NextThreadId.fetch(ctx, (ctx: Context, nextId: ThreadId) => {
			const self = ctx.as<ThreadList>()
			self.resolveNextId(ctx, nextId)
		})
	}

	protected findCategoryId(ctx: Context): CategoryId {
		const categoryId = ctx.select<CategoryId>([
			ctx.param<CategoryId>("id", ctx.parentIfSet()),
			ctx.param<CategoryId>("category"),
		])

		if (categoryId != null) {
			return categoryId
		}

		return 0
	}

	protected findStartIndex(ctx: Context): ThreadId {
		return ctx.mustParam<ThreadId>("start")
	}

	protected resolveNextId(ctx: Context, nextId: ThreadId): void {
		const batch = ThreadById.batch()

		for (let i: ThreadId = this.findStartIndex(ctx); i < nextId; i++) {
			ThreadById.fetch(ctx, i, (ctx: Context, thread: Thread) => {
				const self = ctx.as<ThreadList>()
				self.resolveThread(ctx, thread, self.findCategoryId(ctx))
			})
		}
	}

	protected resolveThread(ctx: Context, thread: Thread, categoryId: CategoryId): void {
		if (categoryId == 0) {
			ctx.produce.json(thread.JSON)
		} else {
			CategoryIdFilter.apply(
				ctx, 
				categoryId,
				thread.JSON,
			)
		}
	}
}
