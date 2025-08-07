import { Component, Inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { GeolocationService } from '@ng-web-apis/geolocation';
import { HttpClient } from '@angular/common/http';
import { Employee } from '../../shared/services/employee';
import { DialogModule } from 'primeng/dialog';
import { ViewChild, ElementRef } from '@angular/core';
import { ImageModule } from 'primeng/image';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-manage-user',
  standalone: true,
  imports: [CardModule, InputTextModule, FileUploadModule, ButtonModule, ReactiveFormsModule, DialogModule, ImageModule, ToastModule],
  templateUrl: './manage-user.html',
  styleUrl: './manage-user.css'
})
export class ManageUser {
  registerForm: FormGroup;
  uploadedFileName: string | null = null;

  showCameraDialog = false;
  private stream: MediaStream | null = null;

  editingEmployee: any = null;

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private faceModelsLoaded = false;

  constructor(
    private fb: FormBuilder,
    private geolocation$: GeolocationService,
    private http: HttpClient,
    private employeeService: Employee,
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    public messageService: MessageService
  ) {
    this.registerForm = this.fb.group({
      employeeId: ['', Validators.required],
      name: ['', [Validators.required, Validators.pattern('^[a-zA-Z\\s]*$')]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      image: [null, Validators.required],
      location: ['', Validators.required]
    });
    if (config && config.data && config.data.employee) {
      this.editingEmployee = config.data.employee;
      this.registerForm.patchValue(config.data.employee);
      this.uploadedFileName = null;
    }
  }

  onClose() {
    this.ref.close();
  }

  onImageUpload(event: any) {
    const file = event.files && event.files.length > 0 ? event.files[0] : null;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.registerForm.patchValue({ image: base64 });
        this.registerForm.get('image')?.updateValueAndValidity();
      };
      reader.readAsDataURL(file);
      this.uploadedFileName = file.name;
    } else {
      this.registerForm.patchValue({ image: null });
      this.uploadedFileName = null;
    }
  }

  removeImage() {
    this.registerForm.patchValue({ image: null });
    this.registerForm.get('image')?.updateValueAndValidity();
    this.uploadedFileName = null;
  }
  openCamera() {
    this.showCameraDialog = true;
    setTimeout(() => {
      this.startCamera();
    }, 100); // Wait for dialog to render
  }

  startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          this.stream = stream;
          if (this.videoRef && this.videoRef.nativeElement) {
            this.videoRef.nativeElement.srcObject = stream;
            this.videoRef.nativeElement.play();
          }
        })
        .catch((err) => {
          alert('Could not access the camera. Please allow camera access.');
          this.closeCamera();
        });
    } else {
      alert('Camera not supported in this browser.');
      this.closeCamera();
    }
  }

  capturePhoto(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/png');
      this.registerForm.patchValue({ image: base64 });
      this.registerForm.get('image')?.updateValueAndValidity();
      this.uploadedFileName = 'captured-photo.png';
      this.closeCamera();
    }
  }

  closeCamera() {
    this.showCameraDialog = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  getCurrentLocation() {
    const subscription = this.geolocation$.subscribe({
      next: (position: GeolocationPosition) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.reverseGeocode(lat, lng);
        subscription.unsubscribe();
      },
      error: () => {
        this.messageService.add({ severity: 'warn', summary: 'Location Tracking Error', detail: 'Unable to access location.' }); subscription.unsubscribe();
      }
    });
  }

  reverseGeocode(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`;
    this.http.get<any>(url).subscribe({
      next: (data) => {
        const address = data.address;
        const city = address.city || address.town || address.village || '';
        let locationString = '';
        if (city) locationString += (locationString ? ', ' : '') + `${city}`;
        if (!locationString) locationString = 'Location not found';
        this.registerForm.patchValue({ location: locationString });
      },
      error: () => {
        alert('Failed to get location details.');
      }
    });
  }

  async loadFaceModels() {
    if (!this.faceModelsLoaded) {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models/face-api/');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models/face-api/);
      await faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models/face-api/);
      this.faceModelsLoaded = true;
    }
  }

  async detectFaceInImage(base64Image: string): Promise<boolean> {
    await this.loadFaceModels();
    const img = new Image();
    img.src = base64Image;
    await new Promise((resolve) => { img.onload = resolve; });
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    const detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor();
    return !!detection;
  }

  async register() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const image = this.registerForm.get('image')?.value;
    if (image) {
      const faceDetected = await this.detectFaceInImage(image);
      if (!faceDetected) {
        this.messageService.add({ severity: 'warn', summary: 'Face Not Detected', detail: 'No face detected in the uploaded image. Please upload a clear photo with your face visible.' });
        return;
      }
    }
    if (this.editingEmployee) {
      this.employeeService.updateEmployee(this.editingEmployee.id || this.editingEmployee.employeeId, this.registerForm.value).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'User updated successfully.' });
          this.ref.close('updated');
        },
        error: () => {
          this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'User not updated.' });
        }
      });
    } else {
      this.employeeService.registerEmployee(this.registerForm.value).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Registered', detail: 'User registered successfully.' });
          this.registerForm.reset();
          this.uploadedFileName = null;
          this.ref.close('updated');
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to register user.' });
        }
      });
    }
  }

  deleteUser() {
    if (this.editingEmployee && confirm('Are you sure you want to delete this user?')) {
      this.employeeService.deleteEmployee(this.editingEmployee.id || this.editingEmployee.employeeId).subscribe(() => {
        alert('User deleted successfully!');
        this.ref.close('deleted');
      });
    }
  }

}
