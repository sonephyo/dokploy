import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { generateSHA256Hash } from "@/lib/utils";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, User } from "lucide-react";
import { useTranslation } from "next-i18next";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Disable2FA } from "./disable-2fa";
import { Enable2FA } from "./enable-2fa";

const profileSchema = z.object({
	email: z.string(),
	password: z.string().nullable(),
	currentPassword: z.string().nullable(),
	image: z.string().optional(),
	allowImpersonation: z.boolean().optional().default(false),
});

type Profile = z.infer<typeof profileSchema>;

const randomImages = [
	"/avatars/avatar-1.png",
	"/avatars/avatar-2.png",
	"/avatars/avatar-3.png",
	"/avatars/avatar-4.png",
	"/avatars/avatar-5.png",
	"/avatars/avatar-6.png",
	"/avatars/avatar-7.png",
	"/avatars/avatar-8.png",
	"/avatars/avatar-9.png",
	"/avatars/avatar-10.png",
	"/avatars/avatar-11.png",
	"/avatars/avatar-12.png",
];


export const ProfileForm = () => {
	const _utils = api.useUtils();
	const { data, refetch, isLoading } = api.user.get.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();

	const [uploadedImage, setUploadedImage] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			event.target.value = ""; // Reset input
			return;
		}

		// Validate file size (2MB) - do this FIRST
		if (file.size > 2 * 1024 * 1024) {
			toast.error("Image size must be less than 2MB");
			event.target.value = ""; // Reset input
			return;
		}

		// Validate file type - check MIME type or file extension
		const isValidImageType = file.type.startsWith('image/') ||
			/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);

		if (!isValidImageType) {
			toast.error("Please upload a valid image file (JPG, PNG, GIF, etc.)");
			event.target.value = ""; // Reset input
			return;
		}

		setIsUploading(true);

		// Convert to base64 or upload to server
		const reader = new FileReader();
		reader.onloadend = () => {
			try {
				const base64String = reader.result as string;
				if (!base64String || typeof base64String !== 'string') {
					throw new Error("Failed to read image");
				}
				// Set both state and form value immediately
				setUploadedImage(base64String);
				form.setValue('image', base64String, { shouldValidate: false });
				toast.success("Image uploaded successfully");
			} catch (error) {
				console.error("Error processing image:", error);
				toast.error("Error processing image file");
				setUploadedImage(null);
			} finally {
				setIsUploading(false);
				event.target.value = ""; // Reset input to allow uploading again
			}
		};
		reader.onerror = (error) => {
			console.error("FileReader error:", error);
			toast.error("Error reading image file");
			setIsUploading(false);
			setUploadedImage(null);
			event.target.value = ""; // Reset input
		};
		reader.readAsDataURL(file);
	};

	const {
		mutateAsync,
		isLoading: isUpdating,
		isError,
		error,
	} = api.user.update.useMutation();
	const { t } = useTranslation("settings");
	const [gravatarHash, setGravatarHash] = useState<string | null>(null);

	const availableAvatars = useMemo(() => {
		const avatars = gravatarHash === null
			? randomImages
			: randomImages.concat([`https://www.gravatar.com/avatar/${gravatarHash}`]);

		if (uploadedImage) {
			return avatars.concat([uploadedImage]);
		}
		return avatars;
	}, [gravatarHash, uploadedImage]);

	const form = useForm<Profile>({
		defaultValues: {
			email: data?.user?.email || "",
			password: "",
			image: data?.user?.image || "",
			currentPassword: "",
			allowImpersonation: data?.user?.allowImpersonation || false,
		},
		resolver: zodResolver(profileSchema),
	});

	useEffect(() => {
		if (data) {
			const currentImage = data?.user?.image || "";

			// Check if the current image is a custom upload (base64 or not in predefined list)
			if (currentImage && !randomImages.includes(currentImage) && !currentImage.includes('gravatar.com')) {
				setUploadedImage(currentImage);
			} else {
				// Clear uploaded image if current image is a predefined avatar or gravatar
				setUploadedImage(null);
			}

			form.reset(
				{
					email: data?.user?.email || "",
					password: form.getValues("password") || "",
					image: currentImage,
					currentPassword: form.getValues("currentPassword") || "",
					allowImpersonation: data?.user?.allowImpersonation,
				},
				{
					keepValues: true,
				},
			);
			form.setValue("allowImpersonation", data?.user?.allowImpersonation);

			if (data.user.email) {
				generateSHA256Hash(data.user.email).then((hash) => {
					setGravatarHash(hash);
				});
			}
		}
	}, [form, data]);

	const onSubmit = async (values: Profile) => {
		await mutateAsync({
			email: values.email.toLowerCase(),
			password: values.password || undefined,
			image: values.image,
			currentPassword: values.currentPassword || undefined,
			allowImpersonation: values.allowImpersonation,
		})
			.then(async () => {
				await refetch();
				toast.success("Profile Updated");
				form.reset({
					email: values.email,
					password: "",
					image: values.image,
					currentPassword: "",
				});
			})
			.catch(() => {
				toast.error("Error updating the profile");
			});
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<CardHeader className="flex flex-row gap-2 flex-wrap justify-between items-center">
						<div>
							<CardTitle className="text-xl flex flex-row gap-2">
								<User className="size-6 text-muted-foreground self-center" />
								{t("settings.profile.title")}
							</CardTitle>
							<CardDescription>
								{t("settings.profile.description")}
							</CardDescription>
						</div>
						{!data?.user.twoFactorEnabled ? <Enable2FA /> : <Disable2FA />}
					</CardHeader>

					<CardContent className="space-y-2 py-8 border-t">
						{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[35vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<Form {...form}>
									<form
										onSubmit={form.handleSubmit(onSubmit)}
										className="grid gap-4"
									>
										<div className="space-y-4">
											<FormField
												control={form.control}
												name="email"
												render={({ field }) => (
													<FormItem>
														<FormLabel>{t("settings.profile.email")}</FormLabel>
														<FormControl>
															<Input
																placeholder={t("settings.profile.email")}
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="currentPassword"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Current Password</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="password"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.password")}
														</FormLabel>
														<FormControl>
															<Input
																type="password"
																placeholder={t("settings.profile.password")}
																{...field}
																value={field.value || ""}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name="image"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t("settings.profile.avatar")}
														</FormLabel>
														<FormControl>
															<RadioGroup
																onValueChange={(e) => {
																	field.onChange(e);
																}}
																defaultValue={field.value}
																value={field.value}
																className="flex flex-row flex-wrap gap-2 max-xl:justify-center"
															>
																{/* Predefined avatars */}
																{randomImages.map((avatar) => (
																	<FormItem key={avatar}>
																		<FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:border-2 cursor-pointer">
																			<FormControl>
																				<RadioGroupItem
																					value={avatar}
																					className="sr-only"
																				/>
																			</FormControl>
																			<div className="h-12 w-12 rounded-full border hover:border-primary transition-transform overflow-hidden">
																				<img
																					src={avatar}
																					alt={`avatar ${avatar}`}
																					className="h-full w-full object-cover"
																				/>
																			</div>
																		</FormLabel>
																	</FormItem>
																))}

																{/* Gravatar option */}
																{gravatarHash && (
																	<FormItem key="gravatar">
																		<FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:border-2 cursor-pointer">
																			<FormControl>
																				<RadioGroupItem
																					value={`https://www.gravatar.com/avatar/${gravatarHash}`}
																					className="sr-only"
																				/>
																			</FormControl>
																			<div className="h-12 w-12 rounded-full border hover:border-primary transition-transform overflow-hidden">
																				<img
																					src={`https://www.gravatar.com/avatar/${gravatarHash}`}
																					alt="gravatar"
																					className="h-full w-full object-cover"
																				/>
																			</div>
																		</FormLabel>
																	</FormItem>
																)}

																{/* Upload button - shows uploaded image when present, + icon otherwise */}
																<FormItem key={"avatar-upload"}>
																	<FormLabel className={(uploadedImage || (field.value && !randomImages.includes(field.value) && !field.value.includes('gravatar.com'))) ? "[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:border-2 cursor-pointer" : "cursor-pointer"}>
																		<FormControl>
																			<>
																				{(uploadedImage || (field.value && !randomImages.includes(field.value) && !field.value.includes('gravatar.com'))) && (
																					<RadioGroupItem
																						value={uploadedImage || field.value}
																						className="sr-only"
																					/>
																				)}
																				<input
																					type="file"
																					accept="image/*"
																					onChange={handleImageUpload}
																					className="sr-only"
																					id="avatar-upload-input"
																				/>
																			</>
																		</FormControl>
																		<label htmlFor="avatar-upload-input">
																			<div className="h-12 w-12 rounded-full border hover:border-primary transition-transform flex items-center justify-center bg-muted overflow-hidden">
																				{isUploading ? (
																					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
																				) : (uploadedImage || (field.value && !randomImages.includes(field.value) && !field.value.includes('gravatar.com'))) ? (
																					<img
																						src={uploadedImage || field.value}
																						alt="uploaded avatar"
																						className="h-full w-full rounded-full object-cover"
																					/>
																				) : (
																					<Plus className="h-6 w-6 text-muted-foreground" />
																				)}
																			</div>
																		</label>
																	</FormLabel>
																</FormItem>
															</RadioGroup>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											{isCloud && (
												<FormField
													control={form.control}
													name="allowImpersonation"
													render={({ field }) => (
														<FormItem className="flex flex-row items-center justify-between p-3 mt-4 border rounded-lg shadow-sm">
															<div className="space-y-0.5">
																<FormLabel>Allow Impersonation</FormLabel>
																<FormDescription>
																	Enable this option to allow Dokploy Cloud
																	administrators to temporarily access your
																	account for troubleshooting and support
																	purposes. This helps them quickly identify and
																	resolve any issues you may encounter.
																</FormDescription>
															</div>
															<FormControl>
																<Switch
																	checked={field.value}
																	onCheckedChange={field.onChange}
																/>
															</FormControl>
														</FormItem>
													)}
												/>
											)}
										</div>

										<div className="flex items-center justify-end gap-2">
											<Button type="submit" isLoading={isUpdating}>
												{t("settings.common.save")}
											</Button>
										</div>
									</form>
								</Form>
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
