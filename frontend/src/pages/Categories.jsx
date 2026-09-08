import { useState, useEffect } from 'react'
import { getCategories, createCategory, deleteCategory } from '../services/category.services'

const Categories = () => {
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', keywords: '' })

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await getCategories()
                setCategories(data)
            } catch (error) {
                console.error('Error fetching categories:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [])

    const handleCreate = async () => {
        if (!form.name || !form.keywords) return
        try {
            const newCategory = await createCategory({
                name: form.name,
                keywords: form.keywords.split(',').map(k => k.trim())
            })
            setCategories([...categories, newCategory])
            setForm({ name: '', keywords: '' })
            setShowForm(false)
        } catch (error) {
            console.error('Error creating category:', error)
        }
    }

    const handleDelete = async (id) => {
        try {
            await deleteCategory(id)
            setCategories(categories.filter(c => c._id !== id))
        } catch (error) {
            console.error('Error deleting category:', error)
        }
    }

    if (loading) return <p className="text-slate-500 font-mono text-sm">loading...</p>

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-medium text-slate-100">categories</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm hover:bg-teal-950/50 transition font-mono"
                >
                    + new category
                </button>
            </div>

            {showForm && (
                <div className="bg-slate-900 border border-slate-800 rounded p-6 mb-6">
                    <p className="font-medium text-slate-100 mb-4 text-sm">Create category</p>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="Category name (e.g. Assignments)"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 rounded px-4 py-2 text-sm focus:outline-none focus:border-teal-600"
                        />
                        <input
                            type="text"
                            placeholder="Keywords comma separated (e.g. pract, lab, assignment)"
                            value={form.keywords}
                            onChange={e => setForm({ ...form, keywords: e.target.value })}
                            className="bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-600 rounded px-4 py-2 text-sm focus:outline-none focus:border-teal-600"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleCreate}
                                className="border border-teal-700 text-teal-400 px-4 py-2 rounded text-sm hover:bg-teal-950/50 transition"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => setShowForm(false)}
                                className="border border-slate-700 text-slate-300 px-4 py-2 rounded text-sm hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {categories.length === 0 ? (
                    <p className="text-slate-500 text-sm">No categories yet. Create one to get started.</p>
                ) : (
                    categories.map(category => (
                        <div key={category._id} className="bg-slate-900 border border-slate-800 rounded p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-sm text-slate-100">{category.name}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {category.keywords.map((kw, i) => (
                                            <span key={i} className="bg-violet-950 text-violet-400 text-xs px-2 py-1 rounded font-mono">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(category._id)}
                                    className="text-red-400 text-sm hover:text-red-300 transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default Categories