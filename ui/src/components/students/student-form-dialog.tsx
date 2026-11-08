"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormGrid } from "@/components/app/field";
import { EXAM_TRACKS } from "@/config/app";
import { useAction } from "@/lib/hooks/use-action";
import { useTenant } from "@/lib/hooks/use-tenant";
import { studentService } from "@/lib/services";
import type { Student } from "@/lib/types";

const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

const schema = z.object({
  name: z.string().trim().min(2, "Enter the student's full name").max(80),
  phone,
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  gender: z.enum(["female", "male", "other"]),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().min(5, "Enter a short address").max(200),
  guardianName: z.string().trim().max(80).optional(),
  guardianPhone: z
    .string()
    .optional()
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v.replace(/\D/g, "").slice(-10)), "Enter a valid 10-digit number"),
  preparingFor: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const EMPTY: FormInput = {
  name: "",
  phone: "",
  email: "",
  gender: "female",
  dateOfBirth: "",
  address: "",
  guardianName: "",
  guardianPhone: "",
  preparingFor: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  student?: Student;
  onSaved?: (s: Student) => void;
}) {
  const { tenantId } = useTenant();
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, handleSubmit, control, reset, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset(
        student
          ? {
              name: student.name,
              phone: student.phone,
              email: student.email,
              gender: student.gender,
              dateOfBirth: student.dateOfBirth ?? "",
              address: student.address,
              guardianName: student.guardianName ?? "",
              guardianPhone: student.guardianPhone ?? "",
              preparingFor: student.preparingFor ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, student, reset]);

  const save = useAction(
    async (values: FormValues) => {
      if (student) {
        await studentService.update(tenantId, student.id, values);
        return student;
      }
      return studentService.create(tenantId, values);
    },
    { success: student ? "Student details updated" : "Student added" },
  );

  const onSubmit = handleSubmit(async (values) => {
    const res = await save.run(values);
    if (res) {
      onOpenChange(false);
      onSaved?.(res);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !save.pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {student ? `Update ${student.name}'s profile.` : "Register a new student. You can assign a seat right after."}
          </DialogDescription>
        </DialogHeader>
        <form id="student-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <FormGrid>
            <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register("name")} autoComplete="name" placeholder="e.g. Priya Sharma" />}
            </Field>
            <Field label="Mobile number" required error={errors.phone?.message}>
              {(p) => <Input {...p} {...register("phone")} inputMode="tel" autoComplete="tel" placeholder="98290 12345" />}
            </Field>
            <Field label="Email" error={errors.email?.message}>
              {(p) => <Input {...p} {...register("email")} type="email" autoComplete="email" placeholder="name@example.com" />}
            </Field>
            <Field label="Gender">
              {(p) => (
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={p.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Date of birth">
              {(p) => <Input {...p} {...register("dateOfBirth")} type="date" />}
            </Field>
            <Field label="Preparing for" className="sm:col-span-2">
              {(p) => (
                <Controller
                  control={control}
                  name="preparingFor"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger id={p.id} className="w-full">
                        <SelectValue placeholder="Select exam / course (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_TRACKS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label="Address" required error={errors.address?.message} className="sm:col-span-2">
              {(p) => <Textarea {...p} {...register("address")} rows={2} autoComplete="street-address" />}
            </Field>
            <Field label="Guardian name">
              {(p) => <Input {...p} {...register("guardianName")} />}
            </Field>
            <Field label="Guardian phone" error={errors.guardianPhone?.message}>
              {(p) => <Input {...p} {...register("guardianPhone")} inputMode="tel" />}
            </Field>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" disabled={save.pending}>
            {save.pending && <Loader2 className="animate-spin" />}
            {student ? "Save changes" : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
