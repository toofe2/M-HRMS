import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface EmailNotificationHook {
  sendLeaveRequestNotification: (requestData: any) => Promise<void>;
  sendStatusUpdateNotification: (requestData: any, status: string) => Promise<void>;
  sendAttendanceNotification: (attendanceData: any) => Promise<void>;
  sendTravelRequestNotification: (travelData: any) => Promise<void>;
}

export function useEmailNotifications(): EmailNotificationHook {
  const { user } = useAuthStore();

  const sendLeaveRequestNotification = useCallback(async (requestData: any) => {
    if (!user) return;

    try {
      // Get manager information
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          first_name,
          last_name,
          direct_manager_id,
          manager:profiles!direct_manager_id (
            email,
            first_name,
            last_name
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileData?.manager?.email) {
        // Queue email notification
        await supabase
          .from('email_logs')
          .insert({
            recipient: profileData.manager.email,
            subject: `New Leave Request - ${profileData.first_name} ${profileData.last_name}`,
            status: 'pending',
            metadata: {
              text: `A new leave request has been submitted by ${profileData.first_name} ${profileData.last_name}.

Leave Type: ${requestData.leave_type}
Start Date: ${requestData.start_date}
End Date: ${requestData.end_date}
Working Days: ${requestData.working_days}
Reason: ${requestData.reason || 'No reason provided'}

Please review this request in the HRMS system.`,
              html: `
                <h2>New Leave Request</h2>
                <p>A new leave request has been submitted by <strong>${profileData.first_name} ${profileData.last_name}</strong>.</p>
                <ul>
                  <li><strong>Leave Type:</strong> ${requestData.leave_type}</li>
                  <li><strong>Start Date:</strong> ${requestData.start_date}</li>
                  <li><strong>End Date:</strong> ${requestData.end_date}</li>
                  <li><strong>Working Days:</strong> ${requestData.working_days}</li>
                  <li><strong>Reason:</strong> ${requestData.reason || 'No reason provided'}</li>
                </ul>
                <p>Please review this request in the HRMS system.</p>
              `
            }
          });
      }
    } catch (error) {
      console.error('Error sending leave request notification:', error);
    }
  }, [user]);

  const sendStatusUpdateNotification = useCallback(async (requestData: any, status: string) => {
    try {
      // Get employee information
      const { data: employeeData } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', requestData.employee_id)
        .single();

      if (employeeData?.email) {
        const statusText = status === 'approved' ? 'Approved' : 'Rejected';
        
        // Queue email notification
        await supabase
          .from('email_logs')
          .insert({
            recipient: employeeData.email,
            subject: `Leave Request ${statusText}`,
            status: 'pending',
            metadata: {
              text: `Dear ${employeeData.first_name} ${employeeData.last_name},

Your leave request has been ${status}.

Leave Details:
- Type: ${requestData.leave_type}
- Start Date: ${requestData.start_date}
- End Date: ${requestData.end_date}
- Working Days: ${requestData.working_days}

${requestData.manager_comments ? 'Manager Comments: ' + requestData.manager_comments : ''}

Best regards,
HR Management System`,
              html: `
                <h2>Leave Request ${statusText}</h2>
                <p>Dear <strong>${employeeData.first_name} ${employeeData.last_name}</strong>,</p>
                <p>Your leave request has been <strong>${status}</strong>.</p>
                <h3>Leave Details:</h3>
                <ul>
                  <li><strong>Type:</strong> ${requestData.leave_type}</li>
                  <li><strong>Start Date:</strong> ${requestData.start_date}</li>
                  <li><strong>End Date:</strong> ${requestData.end_date}</li>
                  <li><strong>Working Days:</strong> ${requestData.working_days}</li>
                </ul>
                ${requestData.manager_comments ? `<p><strong>Manager Comments:</strong> ${requestData.manager_comments}</p>` : ''}
                <p>Best regards,<br>HR Management System</p>
              `
            }
          });
      }
    } catch (error) {
      console.error('Error sending status update notification:', error);
    }
  }, []);

  const sendAttendanceNotification = useCallback(async (attendanceData: any) => {
    if (!user) return;

    try {
      // Get manager information
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          first_name,
          last_name,
          direct_manager_id,
          manager:profiles!direct_manager_id (
            email,
            first_name,
            last_name
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileData?.manager?.email) {
        // Queue email notification
        await supabase
          .from('email_logs')
          .insert({
            recipient: profileData.manager.email,
            subject: `Attendance Review Required - ${profileData.first_name} ${profileData.last_name}`,
            status: 'pending',
            metadata: {
              text: `${profileData.first_name} ${profileData.last_name} checked in outside the office zone and requires review.

Check-in Time: ${attendanceData.check_in_time}
Location: Outside office zone

Please review this attendance record in the HRMS system.`,
              html: `
                <h2>Attendance Review Required</h2>
                <p><strong>${profileData.first_name} ${profileData.last_name}</strong> checked in outside the office zone and requires review.</p>
                <ul>
                  <li><strong>Check-in Time:</strong> ${attendanceData.check_in_time}</li>
                  <li><strong>Location:</strong> Outside office zone</li>
                </ul>
                <p>Please review this attendance record in the HRMS system.</p>
              `
            }
          });
      }
    } catch (error) {
      console.error('Error sending attendance notification:', error);
    }
  }, [user]);

  const sendTravelRequestNotification = useCallback(async (travelData: any) => {
    if (!user) return;

    try {
      // Get manager information
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          first_name,
          last_name,
          direct_manager_id,
          manager:profiles!direct_manager_id (
            email,
            first_name,
            last_name
          )
        `)
        .eq('id', user.id)
        .single();

      if (profileData?.manager?.email) {
        // Queue email notification
        await supabase
          .from('email_logs')
          .insert({
            recipient: profileData.manager.email,
            subject: `Travel Request - ${profileData.first_name} ${profileData.last_name}`,
            status: 'pending',
            metadata: {
              text: `A travel request has been submitted by ${profileData.first_name} ${profileData.last_name}.

From: ${travelData.from_location}
To: ${travelData.to_location}
Departure: ${travelData.departure_date}
Return: ${travelData.return_date}
Estimated Cost: $${travelData.total_cost}

Please review this request in the HRMS system.`,
              html: `
                <h2>Travel Request</h2>
                <p>A travel request has been submitted by <strong>${profileData.first_name} ${profileData.last_name}</strong>.</p>
                <ul>
                  <li><strong>From:</strong> ${travelData.from_location}</li>
                  <li><strong>To:</strong> ${travelData.to_location}</li>
                  <li><strong>Departure:</strong> ${travelData.departure_date}</li>
                  <li><strong>Return:</strong> ${travelData.return_date}</li>
                  <li><strong>Estimated Cost:</strong> $${travelData.total_cost}</li>
                </ul>
                <p>Please review this request in the HRMS system.</p>
              `
            }
          });
      }
    } catch (error) {
      console.error('Error sending travel request notification:', error);
    }
  }, [user]);

  return {
    sendLeaveRequestNotification,
    sendStatusUpdateNotification,
    sendAttendanceNotification,
    sendTravelRequestNotification
  };
}