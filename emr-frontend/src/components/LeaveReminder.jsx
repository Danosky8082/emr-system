// src/components/LeaveReminder.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const LeaveReminder = () => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState({
    upcomingLeaves: [],
    pendingLeaves: [],
    todayLeaves: [],
    stats: { upcomingCount: 0, pendingCount: 0, todayCount: 0 }
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const isHR = user?.role === 'HR' || user?.role === 'Admin' || user?.role === 'ITAdmin';

  useEffect(() => {
    if (token) {
      fetchReminders();
      if (isHR) {
        fetchNotifications();
      }
    }
  }, [token]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/hr/leave-reminders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReminders(res.data);
    } catch (error) {
      console.error('Fetch reminders error:', error);
      toast.error('Failed to load leave reminders');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/hr/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`http://localhost:3000/api/hr/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('http://localhost:3000/api/hr/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
      console.error('Mark all as read error:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const sendReminders = async () => {
    try {
      await axios.post('http://localhost:3000/api/hr/leave-reminders/send', 
        { daysBefore: 7 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Leave reminders sent successfully!');
      fetchReminders();
    } catch (error) {
      console.error('Send reminders error:', error);
      toast.error('Failed to send reminders');
    }
  };

  const getDaysUntil = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (days) => {
    if (days < 0) return { color: '#ef4444', label: '⚠️ Started' };
    if (days === 0) return { color: '#f59e0b', label: '🔔 Today' };
    if (days <= 3) return { color: '#f59e0b', label: `⏰ ${days} day(s)` };
    if (days <= 7) return { color: '#3b82f6', label: `📅 ${days} day(s)` };
    return { color: '#10b981', label: `📆 ${days} day(s)` };
  };

  if (loading) return <div className="spinner-sm" />;

  if (!isHR) {
    return (
      <div className="leave-reminder-container" style={{ marginBottom: '20px' }}>
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🔔 Your Upcoming Leaves
          </h4>
          {reminders.upcomingLeaves.length === 0 && (
            <p style={{ color: '#6b7280' }}>No upcoming leaves scheduled.</p>
          )}
          {reminders.upcomingLeaves.map(leave => {
            const days = getDaysUntil(leave.startDate);
            const status = getStatusBadge(days);
            return (
              <div key={leave.id} style={{
                padding: '12px 16px',
                borderLeft: `4px solid ${status.color}`,
                background: days <= 3 ? '#fef3c7' : '#f8fafc',
                borderRadius: '8px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <div>
                  <strong>{leave.leaveType}</strong>
                  <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>
                    {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                  </span>
                </div>
                <span style={{
                  background: status.color,
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="leave-reminder-container" style={{ marginBottom: '20px' }}>
      {/* Notification Bell */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h4 style={{ margin: 0 }}>🔔 Leave Reminders & Notifications</h4>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-sm btn-primary"
            onClick={sendReminders}
            style={{
              background: '#0f3460',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📤 Send Reminders
          </button>
          <button 
            className="btn btn-sm btn-secondary"
            onClick={fetchReminders}
            style={{
              background: '#e5e7eb',
              color: '#1f2937',
              border: '1px solid #d1d5db',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🔄 Refresh
          </button>
          <div style={{ position: 'relative' }} onClick={() => setShowNotifications(!showNotifications)}>
            <span style={{ fontSize: '24px', cursor: 'pointer' }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f3460' }}>{reminders.stats.upcomingCount}</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Upcoming Leaves</p>
        </div>
        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>{reminders.stats.pendingCount}</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Pending Requests</p>
        </div>
        <div style={{ background: '#dbeafe', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>{reminders.stats.todayCount}</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>On Leave Today</p>
        </div>
      </div>

      {/* Upcoming Leaves Table */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>
          📅 Upcoming Leaves (Next 30 Days)
        </h5>
        {reminders.upcomingLeaves.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>No upcoming leaves scheduled.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Employee</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Start Date</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Days Until</th>
                </tr>
              </thead>
              <tbody>
                {reminders.upcomingLeaves.map(leave => {
                  const days = getDaysUntil(leave.startDate);
                  const status = getStatusBadge(days);
                  return (
                    <tr key={leave.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>
                        <strong>{leave.staff?.firstName} {leave.staff?.lastName}</strong>
                        <span style={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>
                          {leave.staff?.employeeId}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>{leave.leaveType}</td>
                      <td style={{ padding: '8px' }}>{new Date(leave.startDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          background: status.color,
                          color: 'white',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          width: '400px',
          maxHeight: '500px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h4 style={{ margin: 0 }}>🔔 Notifications</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0f3460',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  Mark all read
                </button>
              )}
              <button 
                onClick={() => setShowNotifications(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {notifications.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                No notifications
              </p>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  style={{
                    padding: '12px',
                    background: notification.isRead ? 'white' : '#f0f7ff',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    borderLeft: notification.isGlobal ? '4px solid #f59e0b' : '4px solid #0f3460',
                    cursor: 'pointer'
                  }}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div style={{ fontSize: '13px' }}>
                    {notification.message}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    {new Date(notification.createdAt).toLocaleString()}
                    {notification.isGlobal && (
                      <span style={{ 
                        marginLeft: '8px',
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10px'
                      }}>
                        Global
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveReminder;