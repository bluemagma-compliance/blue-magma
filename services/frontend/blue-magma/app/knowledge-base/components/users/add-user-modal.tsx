"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Users,
  Building,
  AlertTriangle,
  Loader2,
  UserPlus,
  Upload,
  Plus,
  X,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { MockUser, VendorRole } from "../../types";

interface AddUserModalProps {
  onUserAdded: (user: MockUser) => void;
  children: React.ReactNode;
}

export function AddUserModal({ onUserAdded, children }: AddUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual invite form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    vendorRoles: [] as VendorRole[],
  });

  const [currentVendorRole, setCurrentVendorRole] = useState({
    vendor: "",
    role: "",
  });

  const availableVendors = ["GitHub", "AWS", "Jira", "Slack", "Confluence", "Docker Hub"];

  const handleAddVendorRole = () => {
    if (!currentVendorRole.vendor || !currentVendorRole.role) {
      setError("Please select both vendor and role");
      return;
    }

    // Check if vendor already exists
    if (formData.vendorRoles.some(vr => vr.vendor === currentVendorRole.vendor)) {
      setError("This vendor is already added");
      return;
    }

    setFormData(prev => ({
      ...prev,
      vendorRoles: [...prev.vendorRoles, { ...currentVendorRole }],
    }));

    setCurrentVendorRole({ vendor: "", role: "" });
    setError(null);
  };

  const handleRemoveVendorRole = (vendor: string) => {
    setFormData(prev => ({
      ...prev,
      vendorRoles: prev.vendorRoles.filter(vr => vr.vendor !== vendor),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.email) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.vendorRoles.length === 0) {
      setError("Please add at least one vendor role");
      return;
    }

    try {
      setIsSubmitting(true);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create new user
      const newUser: MockUser = {
        id: `user-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        status: "Pending",
        vendorRoles: formData.vendorRoles,
        joinedAt: new Date().toISOString(),
      };

      onUserAdded(newUser);
      toast.success(`Invitation sent to ${formData.name}`);

      // Reset form and close modal
      setFormData({
        name: "",
        email: "",
        vendorRoles: [],
      });
      setCurrentVendorRole({ vendor: "", role: "" });
      setIsOpen(false);
      setActiveTab("manual");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invitation";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveTab("manual");
    setError(null);
    setFormData({
      name: "",
      email: "",
      vendorRoles: [],
    });
    setCurrentVendorRole({ vendor: "", role: "" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Manual Invite</span>
              </TabsTrigger>
              <TabsTrigger value="directory" className="flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Directory Import</span>
                <Badge variant="secondary" className="ml-2">
                  Coming Soon
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="manual" className="h-full mt-0">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Send an invitation to a new team member. They will receive an email with instructions to join your organization.
                    </p>

                    {error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">
                            Full Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="name"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="email">
                            Email Address <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="john.doe@company.com"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* Vendor Roles Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold flex items-center">
                            <Building2 className="mr-2 h-4 w-4" />
                            Vendor Roles <span className="text-red-500 ml-1">*</span>
                          </Label>
                          <Badge variant="outline">
                            {formData.vendorRoles.length} roles
                          </Badge>
                        </div>

                        {/* Add Vendor Role Form */}
                        <div className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium text-sm">Add Vendor Role</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Select
                              value={currentVendorRole.vendor}
                              onValueChange={(value) => setCurrentVendorRole(prev => ({ ...prev, vendor: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVendors.map((vendor) => (
                                  <SelectItem key={vendor} value={vendor}>
                                    {vendor}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Role (e.g., Admin, Developer)"
                              value={currentVendorRole.role}
                              onChange={(e) => setCurrentVendorRole(prev => ({ ...prev, role: e.target.value }))}
                            />
                          </div>
                          <Button type="button" onClick={handleAddVendorRole} size="sm">
                            <Plus className="mr-2 h-3 w-3" />
                            Add Role
                          </Button>
                        </div>

                        {/* Vendor Roles List */}
                        {formData.vendorRoles.length > 0 && (
                          <div className="space-y-2">
                            {formData.vendorRoles.map((vr) => (
                              <div key={vr.vendor} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Badge variant="secondary">{vr.vendor}</Badge>
                                  <span className="text-sm text-muted-foreground">{vr.role}</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveVendorRole(vr.vendor)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={handleClose}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending Invite...
                            </>
                          ) : (
                            <>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Send Invitation
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="directory" className="h-full mt-0">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="text-center space-y-4 py-8">
                    <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                      <Building className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Directory Integration Coming Soon</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Import users from your organization&apos;s directory services like Active Directory, LDAP, or Okta.
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-semibold text-sm mb-3">Planned Integrations</h4>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Active Directory (AD)</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>LDAP Directory Services</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Okta Identity Management</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Auth0 User Management</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Close
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
