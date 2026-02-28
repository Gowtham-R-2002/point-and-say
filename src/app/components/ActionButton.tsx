import { Button } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

export function ActionButton() {
    return (
        <div className="action-button-wrapper" data-component="action-button" style={{ marginTop: 'var(--space-md)' }}>
            <Button
                variant="contained"
                startIcon={<FontAwesomeIcon icon={faPlus} />}
                sx={{
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #e06040 100%)',
                    color: '#0c0c14',
                    fontWeight: 700,
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    padding: '12px 32px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 4px 24px rgba(251, 140, 102, 0.3)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #ffa07a 0%, var(--accent-primary) 100%)',
                        boxShadow: '0 8px 36px rgba(251, 140, 102, 0.45)',
                        transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.25s ease',
                }}
            >
                Quick Action
            </Button>
        </div>
    );
}