import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface EmailNotificationServiceProps {
  children: React.ReactNode;
}

export default function EmailNotificationService({ children }: EmailNotificationServiceProps) {
  useEffect(() => {
    // Set up automatic email processing every 10 seconds
    const processEmails = async () => {
      try {
        // Check if there are pending emails
        const { data: pendingEmails, error } = await supabase
          .from('email_logs')
          .select('id')
          .eq('status', 'pending')
          .limit(1);

        if (error) {
          console.error('Error checking pending emails:', error);
          return;
        }

        // If there are pending emails, process them
        if (pendingEmails && pendingEmails.length > 0) {
          console.log('Processing pending emails...');
          
          const { data, error: processError } = await supabase.functions.invoke('process-pending-emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (processError) {
            console.error('Error processing emails:', processError);
          } else {
            console.log('Email processing result:', data);
          }
        }
      } catch (error) {
        console.error('Error in email processing service:', error);
      }
    };

    // Initial processing
    processEmails();

    // Set up interval for automatic processing
    const interval = setInterval(processEmails, 10000); // 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Listen for new email logs and process them immediately
  useEffect(() => {
    const subscription = supabase
      .channel('email_logs_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'email_logs',
        filter: 'status=eq.pending'
      }, (payload) => {
        console.log('New email queued, processing immediately...');
        
        // Process the new email immediately
        setTimeout(async () => {
          try {
            await supabase.functions.invoke('process-pending-emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });
          } catch (error) {
            console.error('Error processing new email:', error);
          }
        }, 1000); // Small delay to ensure the email is fully inserted
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
