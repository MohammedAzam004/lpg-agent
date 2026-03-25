function QuickActions({ onSelect, actions = [] }) {
  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button key={action} type="button" onClick={() => onSelect(action)}>
          {action}
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
