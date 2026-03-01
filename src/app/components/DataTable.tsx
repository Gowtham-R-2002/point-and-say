import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Chip,
    FormControl,
    Select,
    MenuItem,
} from '@mui/material';
import { useState } from 'react';

interface ActivityRow {
    name: string;
    initials: string;
    avatarColor: string;
    action: string;
    status: 'completed' | 'in-progress' | 'pending';
    time: string;
}

const rows: ActivityRow[] = [
    { name: 'Alex Johnson', initials: 'AJ', avatarColor: '#3b82f6', action: 'Deployed v2.4.1', status: 'completed', time: '2 min ago' },
    { name: 'Maria Garcia', initials: 'MG', avatarColor: '#a855f7', action: 'Updated dashboard', status: 'in-progress', time: '15 min ago' },
    { name: 'James Lee', initials: 'JL', avatarColor: '#22c55e', action: 'Merged PR #847', status: 'completed', time: '1 hr ago' },
    { name: 'Lisa Park', initials: 'LP', avatarColor: '#f97316', action: 'Review requested', status: 'pending', time: '3 hr ago' },
];

const statusColors: Record<string, { bg: string; text: string }> = {
    'completed': { bg: 'rgba(52,211,153,0.15)', text: '#34d399' },
    'in-progress': { bg: 'rgba(251,140,102,0.15)', text: '#fb8c66' },
    'pending': { bg: 'rgba(255,255,255,0.06)', text: 'var(--text-muted)' },
};

export function DataTable() {
    const [filter, setFilter] = useState('all');

    return (
        <div className="data-table-wrapper glass-card" data-component="data-table">
            <div className="data-table-header" data-component="data-table-header">
                <h3>Recent Activity</h3>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        sx={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.8rem',
                            '.MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.08)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255,255,255,0.15)',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'var(--accent-primary)',
                            },
                            '.MuiSvgIcon-root': {
                                color: 'var(--text-muted)',
                            },
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    background: 'var(--surface-glass)',
                                    backdropFilter: 'blur(24px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-sans)',
                                },
                            },
                        }}
                    >
                        <MenuItem value="all">All Activity</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="in-progress">In Progress</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                </FormControl>
            </div>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {['Member', 'Action', 'Status', 'Time'].map((h) => (
                                <TableCell
                                    key={h}
                                    sx={{
                                        color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-sans)',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        borderColor: 'rgba(255,255,255,0.04)',
                                        padding: '12px 16px',
                                    }}
                                >
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .filter((r) => filter === 'all' || r.status === filter)
                            .map((row) => (
                                <TableRow
                                    key={row.name}
                                    sx={{
                                        '&:hover': { background: 'rgba(255,255,255,0.02)' },
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <TableCell
                                        sx={{
                                            borderColor: 'rgba(255,255,255,0.04)',
                                            padding: '12px 16px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Avatar
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    background: row.avatarColor,
                                                    fontFamily: 'var(--font-sans)',
                                                }}
                                            >
                                                {row.initials}
                                            </Avatar>
                                            <span style={{
                                                color: 'var(--text-primary)',
                                                fontFamily: 'var(--font-sans)',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                            }}>
                                                {row.name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '0.82rem',
                                            borderColor: 'rgba(255,255,255,0.04)',
                                            padding: '12px 16px',
                                        }}
                                    >
                                        {row.action}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            borderColor: 'rgba(255,255,255,0.04)',
                                            padding: '12px 16px',
                                        }}
                                    >
                                        <Chip
                                            label={row.status.replace('-', ' ')}
                                            size="small"
                                            sx={{
                                                background: statusColors[row.status].bg,
                                                color: statusColors[row.status].text,
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                fontFamily: 'var(--font-sans)',
                                                textTransform: 'capitalize',
                                                height: 24,
                                                border: 'none',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            color: 'var(--text-muted)',
                                            fontFamily: 'var(--font-sans)',
                                            fontSize: '0.78rem',
                                            borderColor: 'rgba(255,255,255,0.04)',
                                            padding: '12px 16px',
                                        }}
                                    >
                                        {row.time}
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}
