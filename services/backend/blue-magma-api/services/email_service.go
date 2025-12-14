package services

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"os"
	"time"

	"github.com/mailgun/mailgun-go/v4"
	log "github.com/sirupsen/logrus"
)

type EmailService struct {
	mg     *mailgun.MailgunImpl
	domain string
}

type InvitationEmailData struct {
	InvitedUserEmail string
	InviterName      string
	OrganizationName string
	Role             string
	InvitationURL    string
	ExpirationDate   string
}

type PasswordResetEmailData struct {
	UserEmail     string
	ResetURL      string
	ExpirationRaw time.Time
}

func NewEmailService() *EmailService {
	apiKey := os.Getenv("MAILGUN_API_KEY")
	domain := os.Getenv("MAILGUN_DOMAIN")

	if apiKey == "" || domain == "" {
		log.Fatal("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set")
	}

	mg := mailgun.NewMailgun(domain, apiKey)

	return &EmailService{
		mg:     mg,
		domain: domain,
	}
}

func (es *EmailService) SendInvitationEmail(data InvitationEmailData) error {
	subject := fmt.Sprintf("You're invited to join %s on Blue Magma", data.OrganizationName)

	htmlBody, err := es.generateInvitationHTML(data)
	if err != nil {
		return fmt.Errorf("failed to generate email HTML: %w", err)
	}

	textBody := es.generateInvitationText(data)

	message := es.mg.NewMessage(
		fmt.Sprintf("Blue Magma <noreply@%s>", es.domain),
		subject,
		textBody,
		data.InvitedUserEmail,
	)

	message.SetHtml(htmlBody)

	// Add unique message ID to prevent threading
	uniqueID := fmt.Sprintf("invitation-%d", time.Now().UnixNano())
	message.AddHeader("Message-ID", fmt.Sprintf("<%s@%s>", uniqueID, es.domain))

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
	defer cancel()

	_, _, err = es.mg.Send(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	log.Infof("Invitation email sent to %s for organization %s", data.InvitedUserEmail, data.OrganizationName)
	return nil
}

func (es *EmailService) SendPasswordResetEmail(data PasswordResetEmailData) error {
	subject := "Reset your Blue Magma password"

	htmlBody, err := es.generatePasswordResetHTML(data)
	if err != nil {
		return fmt.Errorf("failed to generate password reset email: %w", err)
	}

	textBody := es.generatePasswordResetText(data)

	message := es.mg.NewMessage(
		fmt.Sprintf("Blue Magma <noreply@%s>", es.domain),
		subject,
		textBody,
		data.UserEmail,
	)

	message.SetHtml(htmlBody)

	uniqueID := fmt.Sprintf("password-reset-%d", time.Now().UnixNano())
	message.AddHeader("Message-ID", fmt.Sprintf("<%s@%s>", uniqueID, es.domain))

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
	defer cancel()

	_, _, err = es.mg.Send(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to send password reset email: %w", err)
	}

	log.Infof("Password reset email sent to %s", data.UserEmail)
	return nil
}


func (es *EmailService) generateInvitationHTML(data InvitationEmailData) (string, error) {
	tmpl := `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to {{.OrganizationName}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { max-width: 200px; height: auto; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Blue Magma</h2>
        </div>

        <div class="content">
            <h1>You're invited to join {{.OrganizationName}}!</h1>

            <p>Hi there,</p>

            <p><strong>{{.InviterName}}</strong> has invited you to join <strong>{{.OrganizationName}}</strong> on Blue Magma as a <strong>{{.Role}}</strong>.</p>

            <div class="details">
                <h3>Invitation Details:</h3>
                <ul>
                    <li><strong>Organization:</strong> {{.OrganizationName}}</li>
                    <li><strong>Role:</strong> {{.Role}}</li>
                    <li><strong>Invited by:</strong> {{.InviterName}}</li>
                    <li><strong>Expires:</strong> {{.ExpirationDate}}</li>
                </ul>
            </div>

            <p style="text-align: center; margin: 30px 0;">
                <a href="{{.InvitationURL}}" class="button">Accept Invitation</a>
            </p>

            <p><small>This invitation will expire on {{.ExpirationDate}}. If you don't accept by then, you'll need to request a new invitation.</small></p>
        </div>

        <div class="footer">
            <p>This email was sent by Blue Magma. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>`

	t, err := template.New("invitation").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (es *EmailService) generateInvitationText(data InvitationEmailData) string {
	return fmt.Sprintf(`
You're invited to join %s!

Hi there,

%s has invited you to join %s on Blue Magma as a %s.

Invitation Details:
• Organization: %s
• Role: %s
• Invited by: %s
• Expires: %s

Accept your invitation: %s

This invitation will expire on %s. If you don't accept by then, you'll need to request a new invitation.

---
This email was sent by Blue Magma. If you didn't expect this invitation, you can safely ignore this email.
`,
		data.OrganizationName,
		data.InviterName,
		data.OrganizationName,
		data.Role,
		data.OrganizationName,
		data.Role,
		data.InviterName,
		data.ExpirationDate,
		data.InvitationURL,
		data.ExpirationDate,
	)
}

func (es *EmailService) generatePasswordResetHTML(data PasswordResetEmailData) (string, error) {
	expires := data.ExpirationRaw.Format("January 2, 2006 at 3:04 PM MST")
	tmpl := `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your Blue Magma password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Blue Magma</h2>
        </div>

        <div class="content">
            <h1>Reset your password</h1>
            <p>We received a request to reset the password for your Blue Magma account.</p>
            <p>If you made this request, click the button below to choose a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{{.ResetURL}}" class="button" style="color: #ffffff !important;">Reset your password</a>
            </p>
            <p><small>This link will expire on {{.Expiration}}. If you didn't request a password reset, you can safely ignore this email.</small></p>
        </div>
        <div class="footer">
            <p>This email was sent by Blue Magma.</p>
        </div>
    </div>
</body>
</html>`

	dataMap := map[string]interface{}{
		"ResetURL":   data.ResetURL,
		"Expiration": expires,
	}

	t, err := template.New("password_reset").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, dataMap); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (es *EmailService) generatePasswordResetText(data PasswordResetEmailData) string {
	expires := data.ExpirationRaw.Format("January 2, 2006 at 3:04 PM MST")
	return fmt.Sprintf(`
Reset your Blue Magma password

We received a request to reset the password for your Blue Magma account.

If you made this request, use the link below to choose a new password:
%s

This link will expire on %s. If you didn't request a password reset, you can safely ignore this email.

---
This email was sent by Blue Magma.
`, data.ResetURL, expires)
}

