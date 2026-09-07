import { useState, useEffect } from 'react'
import { getChildren, refreshNode, createFolder, deleteNode, renameNode, moveNode } from '../services/driveTree.services'

const getFileIcon = (mimeType) => {
    if (mimeType === 'application/vnd.google-apps.folder') return '📁'
    if (mimeType.includes('image')) return '🖼️'
    if (mimeType.includes('pdf')) return '📕'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📊'
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
    if (mimeType.includes('video')) return '🎬'
    if (mimeType.includes('audio')) return '🎵'
    return '📄'
}

const isFolder = (mimeType) => mimeType === 'application/vnd.google-apps.folder'

const TreeNode = ({ node, onDelete, isLast = false }) => {
    const [expanded, setExpanded] = useState(false)
    const [children, setChildren] = useState([])
    const [loading, setLoading] = useState(false)
    const [editing, setEditing] = useState(false)
    const [newName, setNewName] = useState(node.name)
    const [creatingFolder, setCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [hovered, setHovered] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const folder = isFolder(node.mimeType)

    // A drop somewhere else in the tree moved one of our children away —
    // prune it locally. No-op if we're collapsed or don't have it; if
    // we're expanded and did, this is what makes it disappear from here
    // without needing a manual refresh.
    useEffect(() => {
        const handleMoved = (e) => {
            const { nodeId: movedId, oldParentId } = e.detail
            if (oldParentId === node.nodeId) {
                setChildren(prev => prev.filter(c => c.nodeId !== movedId))
            }
        }
        window.addEventListener('drive-node-moved', handleMoved)
        return () => window.removeEventListener('drive-node-moved', handleMoved)
    }, [node.nodeId])

    const handleExpand = async () => {
        if (!folder) return
        if (expanded) { setExpanded(false); return }
        setLoading(true)
        try {
            const data = await getChildren(node.nodeId)
            setChildren(data.children)
            setExpanded(true)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async (e) => {
        e.stopPropagation()
        await refreshNode(node.nodeId)
        const data = await getChildren(node.nodeId)
        setChildren(data.children)
    }

    const handleRename = async () => {
        if (!newName.trim() || newName === node.name) { setEditing(false); return }
        await renameNode(node.nodeId, newName)
        node.name = newName
        setEditing(false)
    }

    const handleDelete = async (e) => {
        e.stopPropagation()
        if (!window.confirm(`Delete "${node.name}"?`)) return
        await deleteNode(node.nodeId)
        onDelete(node.nodeId)
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return
        const created = await createFolder(node.nodeId, newFolderName)
        setChildren(prev => [...prev, {
            nodeId: created.nodeId,
            name: created.name,
            mimeType: created.mimeType,
            isLoaded: true,
            children: []
        }])
        setNewFolderName('')
        setCreatingFolder(false)
    }

    const handleChildDelete = (id) => setChildren(prev => prev.filter(c => c.nodeId !== id))

    const handleDragStart = (e) => {
        e.stopPropagation()
        e.dataTransfer.setData('text/plain', node.nodeId)
        e.dataTransfer.setData('application/x-old-parent', node.parentId || '')
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        if (!folder) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragEnter = (e) => {
        if (!folder) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(true)
    }

    const handleDragLeave = () => setDragOver(false)

    const handleDrop = async (e) => {
        if (!folder) return
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        const draggedId = e.dataTransfer.getData('text/plain')
        const oldParentId = e.dataTransfer.getData('application/x-old-parent')
        if (!draggedId || draggedId === node.nodeId) return
        try {
            await moveNode(draggedId, node.nodeId)
            window.dispatchEvent(new CustomEvent('drive-node-moved', {
                detail: { nodeId: draggedId, oldParentId, newParentId: node.nodeId }
            }))
            // The cache is already updated server-side, so a normal
            // (cache-hitting) re-fetch is enough to pick up the new child.
            if (expanded) {
                const data = await getChildren(node.nodeId)
                setChildren(data.children)
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Could not move that item.')
        }
    }

    return (
        <div style={{ position: 'relative', paddingLeft: '20px' }}>

            {/* Vertical line from parent */}
            <div style={{
                position: 'absolute',
                left: '8px',
                top: 0,
                bottom: isLast ? '14px' : 0,
                width: '1px',
                background: '#374151'
            }} />

            {/* Horizontal line to node */}
            <div style={{
                position: 'absolute',
                left: '8px',
                top: '14px',
                width: '12px',
                height: '1px',
                background: '#374151'
            }} />

            {/* Node row */}
            <div
                draggable={!editing}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={handleExpand}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    cursor: folder ? 'pointer' : 'default',
                    background: dragOver ? 'rgba(79, 70, 229, 0.25)' : hovered ? '#1f2937' : 'transparent',
                    outline: dragOver ? '1px solid #4f46e5' : 'none',
                    minHeight: '28px'
                }}
            >
                {/* Expand arrow */}
                <span style={{ width: '12px', color: '#9ca3af', fontSize: '10px', flexShrink: 0 }}>
                    {folder ? (loading ? '⋯' : expanded ? '▼' : '▶') : ''}
                </span>

                {/* Icon */}
                <span style={{ fontSize: '15px', flexShrink: 0 }}>
                    {folder ? (expanded ? '📂' : '📁') : getFileIcon(node.mimeType)}
                </span>

                {/* Name */}
                {editing ? (
                    <input
                        autoFocus
                        value={newName}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setNewName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={e => e.key === 'Enter' && handleRename()}
                        style={{
                            background: '#111827',
                            border: '1px solid #4f46e5',
                            borderRadius: '4px',
                            color: '#f9fafb',
                            fontSize: '13px',
                            padding: '1px 6px',
                            width: '160px',
                            outline: 'none'
                        }}
                    />
                ) : (
                    <span
                        onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
                        style={{ fontSize: '13px', color: '#f3f4f6', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                        {node.name}
                    </span>
                )}

                {/* Actions — only on hover */}
                {hovered && (
                    <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {folder && (
                            <>
                                <button onClick={e => { e.stopPropagation(); setCreatingFolder(true); if (!expanded) handleExpand() }}
                                    title="New folder"
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '14px', padding: '0 3px' }}>＋</button>
                                <button onClick={handleRefresh}
                                    title="Refresh"
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', padding: '0 3px' }}>↻</button>
                            </>
                        )}
                        <button onClick={handleDelete}
                            title="Delete"
                            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', padding: '0 3px' }}>✕</button>
                    </div>
                )}
            </div>

            {/* New folder input */}
            {creatingFolder && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '32px', paddingBottom: '4px' }}>
                    <span>📁</span>
                    <input
                        autoFocus
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                        onBlur={() => { if (!newFolderName.trim()) setCreatingFolder(false) }}
                        placeholder="Folder name"
                        style={{
                            background: '#111827', border: '1px solid #4f46e5', borderRadius: '4px',
                            color: '#f9fafb', fontSize: '13px', padding: '2px 8px', width: '150px', outline: 'none'
                        }}
                    />
                    <button onClick={handleCreateFolder}
                        style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        Create
                    </button>
                </div>
            )}

            {/* Children */}
            {expanded && (
                <div>
                    {children.length === 0 ? (
                        <div style={{ paddingLeft: '20px', fontSize: '12px', color: '#6b7280', padding: '4px 0 4px 32px' }}>
                            Empty folder
                        </div>
                    ) : (
                        children.map((child, index) => (
                            <TreeNode
                                key={child.nodeId}
                                node={child}
                                onDelete={handleChildDelete}
                                isLast={index === children.length - 1}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export default TreeNode