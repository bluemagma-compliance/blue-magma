import { NextRequest, NextResponse } from "next/server";

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  message: string;
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate form data
function validateContactForm(data: {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  message: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields validation
  const requiredFields: (keyof typeof data)[] = [
    "firstName",
    "lastName",
    "email",
    "company",
    "role",
    "teamSize",
    "message",
  ];

  for (const field of requiredFields) {
    if (
      !data[field] ||
      typeof data[field] !== "string" ||
      data[field].trim() === ""
    ) {
      errors.push(`${field} is required`);
    }
  }

  // Email format validation
  if (data.email && !emailRegex.test(data.email)) {
    errors.push("Invalid email format");
  }

  // Length validations
  if (data.firstName && data.firstName.length > 50) {
    errors.push("First name must be less than 50 characters");
  }

  if (data.lastName && data.lastName.length > 50) {
    errors.push("Last name must be less than 50 characters");
  }

  if (data.company && data.company.length > 100) {
    errors.push("Company name must be less than 100 characters");
  }

  if (data.message && data.message.length > 1000) {
    errors.push("Message must be less than 1000 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Sanitize input data
function sanitizeContactForm(data: ContactFormData): ContactFormData {
  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    company: data.company.trim(),
    role: data.role.trim(),
    teamSize: data.teamSize.trim(),
    message: data.message.trim(),
  };
}

// Format email content
function formatEmailContent(data: ContactFormData): string {
  return `
New Contact Form Submission

Contact Information:
- Name: ${data.firstName} ${data.lastName}
- Email: ${data.email}
- Company: ${data.company}
- Role: ${data.role}
- Team Size: ${data.teamSize}

Message:
${data.message}

---
Submitted at: ${new Date().toISOString()}
Source: Blue Magma Contact Form
  `.trim();
}

// Mock email sending function (replace with actual email service)
async function sendEmail(data: ContactFormData): Promise<boolean> {
  try {
    // In a real implementation, you would integrate with an email service like:
    // - SendGrid
    // - AWS SES
    // - Mailgun
    // - Resend
    // - Nodemailer with SMTP

    console.log("Contact form submission received:");
    console.log("---");
    console.log(formatEmailContent(data));
    console.log("---");

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // For now, we'll just log the submission and return success
    // In production, replace this with actual email sending logic
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Store submission in database (mock implementation)
async function storeSubmission(data: ContactFormData): Promise<boolean> {
  try {
    // In a real implementation, you would store this in your database
    // For now, we'll just log it
    console.log("Storing contact submission in database:", {
      ...data,
      submittedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Error storing submission:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate form data
    const validation = validateContactForm(body);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    // Sanitize form data
    const sanitizedData = sanitizeContactForm(body as ContactFormData);

    // Store submission in database
    const stored = await storeSubmission(sanitizedData);
    if (!stored) {
      console.error("Failed to store contact submission");
      // Continue with email sending even if storage fails
    }

    // Send email notification
    const emailSent = await sendEmail(sanitizedData);
    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send email notification" },
        { status: 500 },
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message:
          "Contact form submitted successfully. We will respond within 24 hours.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing contact form:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
