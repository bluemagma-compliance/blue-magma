"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  Shield,
  FileText,
  Clock,
  Users,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { TranslucentHeader } from "@/components/ui/translucent-header";
import { FooterMVP } from "@/components/ui/footer-mvp";

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  message: string;
}

const roleOptions = [
  "Chief Technology Officer",
  "Chief Information Security Officer",
  "Compliance Manager",
  "Security Engineer",
  "DevOps Engineer",
  "Software Engineer",
  "Product Manager",
  "Legal Counsel",
  "Other",
];

const teamSizeOptions = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

const frameworks = [
  { name: "HIPAA", color: "text-blue-400" },
  { name: "GDPR", color: "text-green-400" },
  { name: "SOC 2", color: "text-purple-400" },
  { name: "PCI DSS", color: "text-red-400" },
];

const automationFeatures = [
  "Automated evidence collection",
  "Real-time compliance monitoring",
  "Custom framework support",
];

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "",
    teamSize: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProduction, setIsProduction] = useState(false);

  // Check if we're in production environment
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development";
    setIsProduction(!isDev);

    // Redirect to home page if in production
    if (!isDev) {
      window.location.href = "/";
    }
  }, []);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "company",
      "role",
      "teamSize",
      "message",
    ];
    const missingFields = requiredFields.filter(
      (field) => !formData[field as keyof ContactFormData],
    );

    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(
          "Message sent successfully! We'll respond within 24 hours.",
        );
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          company: "",
          role: "",
          teamSize: "",
          message: "",
        });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading or redirect message in production
  if (isProduction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Page Not Available
          </h1>
          <p className="text-slate-300">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      <TranslucentHeader />
      <div className="container mx-auto px-4 py-16 pt-32">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Get in Touch with Our Compliance Experts
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
            Blue Magma automates compliance evidence collection and monitoring
            for HIPAA, GDPR, SOC 2, and more frameworks. Let our experts help
            you streamline your compliance processes.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto lg:items-start">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-white flex items-center gap-2">
                  <Mail className="h-6 w-6 text-blue-400" />
                  Send us a Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="firstName"
                        className="text-white mb-2 block"
                      >
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          handleInputChange("firstName", e.target.value)
                        }
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-400"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="lastName"
                        className="text-white mb-2 block"
                      >
                        Last Name *
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) =>
                          handleInputChange("lastName", e.target.value)
                        }
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-400"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-white mb-2 block">
                      Work Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-400"
                      placeholder="john.doe@company.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="company" className="text-white mb-2 block">
                      Company *
                    </Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) =>
                        handleInputChange("company", e.target.value)
                      }
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-400"
                      placeholder="Your Company Name"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white mb-2 block">Role *</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) =>
                          handleInputChange("role", value)
                        }
                      >
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white focus:border-blue-400">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {roleOptions.map((role) => (
                            <SelectItem
                              key={role}
                              value={role}
                              className="text-white hover:bg-slate-700"
                            >
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-white mb-2 block">
                        Team Size *
                      </Label>
                      <Select
                        value={formData.teamSize}
                        onValueChange={(value) =>
                          handleInputChange("teamSize", value)
                        }
                      >
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white focus:border-blue-400">
                          <SelectValue placeholder="Select team size" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {teamSizeOptions.map((size) => (
                            <SelectItem
                              key={size}
                              value={size}
                              className="text-white hover:bg-slate-700"
                            >
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-white mb-2 block">
                      Message *
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        handleInputChange("message", e.target.value)
                      }
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-400 min-h-32"
                      placeholder="Tell us about your compliance needs and how we can help..."
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="flex flex-col space-y-6">
            {/* Ready to Get Started */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm flex-1">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-400" />
                  Ready to Get Started?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 mb-4">
                  Reach out directly to our compliance team:
                </p>
                <a
                  href="mailto:sales@bluemagma.net"
                  className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-2"
                >
                  sales@bluemagma.net
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            {/* Supported Frameworks */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm flex-1">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  Supported Frameworks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {frameworks.map((framework) => (
                    <div
                      key={framework.name}
                      className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 text-center"
                    >
                      <span className={`font-semibold ${framework.color}`}>
                        {framework.name}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <span className="text-slate-300 text-sm">
                    + Custom Compliance Frameworks
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Evidence Automation */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm flex-1">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  Evidence Automation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {automationFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="text-slate-300 flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Demo Section */}
        <div className="mt-16">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
                <Calendar className="h-6 w-6 text-blue-400" />
                Prefer to Start with a Demo?
              </CardTitle>
              <CardDescription className="text-slate-300 max-w-2xl mx-auto">
                See Blue Magma in action with a personalized demo showing how we
                automate evidence collection for your specific compliance
                frameworks.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3">
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Demo
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent border-2 border-slate-400 text-white hover:bg-slate-700/50 hover:border-slate-300 hover:text-white font-semibold px-8 py-3 transition-all duration-300 transform hover:scale-105"
                >
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <FooterMVP />
    </div>
  );
}
