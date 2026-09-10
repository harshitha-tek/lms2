import React from 'react';

export const StatusBadge = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'APPROVED':
        return 'status-approved';
      case 'PENDING_MANAGER':
      case 'PENDING_HR':
        return 'status-pending';
      case 'REJECTED':
        return 'status-rejected';
      case 'REJECTED_PENDING_WITHDRAWAL':
        return 'status-advance-warning';
      case 'CANCELLATION_REQUESTED':
        return 'status-pending';
      case 'CANCELLED':
        return 'status-cancelled';
      case 'WITHDRAWN':
      case 'DRAFT':
      case 'LOP_APPLIED':
      default:
        return 'status-neutral';
    }
  };

  const getLabel = () => {
    if (!status) return 'Unknown';
    switch (status) {
      case 'PENDING_MANAGER':
        return 'Pending Manager';
      case 'PENDING_HR':
        return 'Pending HR';
      case 'REJECTED_PENDING_WITHDRAWAL':
        return 'Rejected (Withdrawal Open)';
      case 'CANCELLATION_REQUESTED':
        return 'Cancellation Requested';
      case 'LOP_APPLIED':
        return 'Loss of Pay Applied';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  return (
    <span className={`status-badge ${getStyle()}`}>
      {getLabel()}
    </span>
  );
};
