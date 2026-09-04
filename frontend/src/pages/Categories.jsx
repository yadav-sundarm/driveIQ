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

    if (loading) return <p>Loading...</p>

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
                >
                    + New Category
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="font-medium text-gray-900 mb-4">Create Category</h2>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="Category name (e.g. Assignments)"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            type="text"
                            placeholder="Keywords comma separated (e.g. pract, lab, assignment)"
                            value={form.keywords}
                            onChange={e => setForm({ ...form, keywords: e.target.value })}
                            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={handleCreate}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => setShowForm(false)}
                                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4">
                {categories.length === 0 ? (
                    <p className="text-gray-500">No categories yet. Create one to get started.</p>
                ) : (
                    categories.map(category => (
                        <div key={category._id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">{category.name}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {category.keywords.map((kw, i) => (
                                            <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full">
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(category._id)}
                                    className="text-red-500 text-sm hover:text-red-700 transition"
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