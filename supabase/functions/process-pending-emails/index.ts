import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  metadata: {
    text: string;
    html: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get SMTP settings
    const { data: smtpData, error: smtpError } = await supabase
      .from('smtp_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (smtpError || !smtpData) {
      throw new Error('SMTP settings not configured');
    }

    const smtpSettings: SMTPSettings = smtpData;

    // Get pending emails
    const { data: pendingEmails, error: emailsError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50); // Process up to 50 emails at a time

    if (emailsError) {
      throw new Error(`Failed to fetch pending emails: ${emailsError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending emails to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    // Process each pending email
    for (const email of pendingEmails) {
      try {
        // Simulate email sending (replace with actual SMTP implementation)
        const result = await sendEmail(smtpSettings, email);
        
        // Update email status to sent
        await supabase
          .from('email_logs')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        successCount++;
        
      } catch (error) {
        // Update email status to failed with error message
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        failureCount++;
        console.error(`Failed to send email ${email.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        processed: pendingEmails.length,
        success: successCount,
        failed: failureCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing emails:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendEmail(smtpSettings: SMTPSettings, email: EmailLog) {
  // This is a simplified email sending implementation
  // In production, you would use a proper SMTP library like nodemailer
  
  const emailData = {
    from: smtpSettings.from_email,
    to: email.recipient,
    subject: email.subject,
    text: email.metadata.text,
    html: email.metadata.html
  };

  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // For demonstration, we'll randomly succeed or fail
  if (Math.random() > 0.1) { // 90% success rate
    console.log('Email sent successfully:', emailData);
    return { messageId: 'simulated-' + Date.now() };
  } else {
    throw new Error('Simulated SMTP error');
  }
}