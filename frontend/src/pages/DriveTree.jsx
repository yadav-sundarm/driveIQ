import { useState, useEffect } from 'react'
import { getChildren, moveNode } from '../services/driveTree.services'
import TreeNode from '../components/TreeNode'

const DriveTree = () => {
    const [roots, setRoots] = useState([])
    const [loading, setLoading] = useState(true)
    const [dragOver, setDragOver] = useState(false)

    useEffect(() => {
        const fetchRoot = async () => {
            try {
                const data = await getChildren("root")
                setRoots(data.children)
            } catch (error) {
                console.error("Error fetching root:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchRoot()
    }, [])

    useEffect(() => {
        const handleMoved = async (e) => {
            const { nodeId: movedId, oldParentId, newParentId } = e.detail
            if (oldParentId === 'root') {
                setRoots(prev => prev.filter(n => n.nodeId !== movedId))
            }
            if (newParentId === 'root') {
                const data = await getChildren('root')
                setRoots(data.children)
            }
        }
        window.addEventListener('drive-node-moved', handleMoved)
        return () => window.removeEventListener('drive-node-moved', handleMoved)
    }, [])

    const handleRootDelete = (deletedId) => {
        setRoots(prev => prev.filter(n => n.nodeId !== deletedId))
    }

    const handleRootDragOver = (e) => e.preventDefault()
    const handleRootDragEnter = (e) => { e.preventDefault(); setDragOver(true) }
    const handleRootDragLeave = () => setDragOver(false)

    const handleRootDrop = async (e) => {
        e.preventDefault()
        setDragOver(false)
        const draggedId = e.dataTransfer.getData('text/plain')
        const oldParentId = e.dataTransfer.getData('application/x-old-parent')
        if (!draggedId || oldParentId === 'root') return
        try {
            await moveNode(draggedId, 'root')
            window.dispatchEvent(new CustomEvent('drive-node-moved', {
                detail: { nodeId: draggedId, oldParentId, newParentId: 'root' }
            }))
        } catch (err) {
            alert(err.response?.data?.message || 'Could not move that item.')
        }
    }

    if (loading) return (
        <div className="p-8">
            <p className="text-gray-500">Loading your Drive...</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Drive Explorer</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Click folders to expand. Double-click to rename. Hover for actions.
                    </p>
                </div>
            </div>

            <div
                onDragOver={handleRootDragOver}
                onDragEnter={handleRootDragEnter}
                onDragLeave={handleRootDragLeave}
                onDrop={handleRootDrop}
                style={{
                    background: '#111827',
                    borderRadius: '12px',
                    padding: '16px',
                    border: dragOver ? '1px solid #4f46e5' : '1px solid #1f2937',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1f2937' }}>
                    <span>🗂️</span>
                    <span style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '14px' }}>My Drive</span>
                </div>
                <div style={{ position: 'relative', paddingLeft: '8px' }}>
                    {roots.map((node, index) => (
                        <TreeNode
                            key={node.nodeId}
                            node={node}
                            onDelete={handleRootDelete}
                            isLast={index === roots.length - 1}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default DriveTree