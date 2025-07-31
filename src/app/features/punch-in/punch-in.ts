import { CommonModule } from '@angular/common';
import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnInit,
  OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
import * as faceapi from 'face-api.js';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ImageModule } from 'primeng/image';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Employee } from '../../shared/services/employee';
import { ConfirmPopupModule } from 'primeng/confirmpopup';

interface Punch {
  timestamp: string;
  image: string;
  location: {
    lat: number | null;
    long: number | null;
  };
}

interface LocationLog {
  timestamp: string;
  lat: number;
  long: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, ButtonModule, ImageModule, CardModule, DividerModule, ToastModule, ConfirmPopupModule],
  providers: [MessageService, ConfirmationService],
  selector: 'app-punch-in',
  templateUrl: './punch-in.html',
  styleUrls: ['./punch-in.css']
})
export class PunchIn implements OnInit, AfterViewInit {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  punchData: Punch[] = [];
  latitude: number | null = null;
  longitude: number | null = null;
  isFaceDetected: boolean = false;
  camera_permission: boolean = true;
  location_permission: boolean = true;
  timerWorker: Worker | undefined;


  sessionActive: boolean = false;
  sessionStartTime!: Date;
  sessionTimer!: ReturnType<typeof setTimeout>;
  locationInterval!: ReturnType<typeof setInterval>;
  locationLogs: LocationLog[] = [];

  employees: any[] = [];
  employeeDescriptors: { id: number, name: string, descriptor: Float32Array }[] = [];
  isLoadingDescriptors: boolean = true;
  detectedEmployee: any = null;
  lastFaceNotRecognizedTime: number = 0;
  detectedUser: string = "";

  constructor(
    private router: Router,
    private messageService: MessageService,
    private employeeService: Employee,
    private confirmationService: ConfirmationService
  ) { }

  async ngOnInit() {
    await this.loadModels();
    await this.loadEmployeeDescriptors();
  }

  async ngAfterViewInit() {
    this.startVideo();
  }

  async loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  }

  //load face descriptors
  async loadEmployeeDescriptors() {
    this.isLoadingDescriptors = true;

    this.employees = await new Promise<any[]>((resolve, reject) => {
      this.employeeService.getEmployees().subscribe({
        next: resolve,
        error: reject
      });
    });

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

    for (const emp of this.employees) {
      try {
        const img = await faceapi.fetchImage(emp.image);
        const detection = await faceapi
          .detectSingleFace(img, options)
          .withFaceLandmarks()
          .withFaceDescriptor();
        console.log('Detection for', emp.name, ':', detection);
        if (detection) {
          this.employeeDescriptors.push({
            id: emp.id,
            name: emp.name,
            descriptor: detection.descriptor
          });
        }
      } catch (err) {
        console.error('Error loading image for', emp.name, err);
      }
    }
    this.isLoadingDescriptors = false;
    console.log('Loaded employee descriptors:', this.employeeDescriptors);

  }

  startVideo() {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        this.videoRef.nativeElement.srcObject = stream;
        this.videoRef.nativeElement.play();
        this.detectFace();
      })
      .catch((err) => {
        this.camera_permission = false
        this.messageService.add({
          severity: 'warn',
          summary: 'Warning',
          detail: `WebCam permission denied`,
          life: 4000
        });
      });
  }

  // detects face from camera
  async detectFace() {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

    const interval = setInterval(async () => {

      const result = await faceapi.detectSingleFace(
        this.videoRef.nativeElement,
        options
      ).withFaceLandmarks().withFaceDescriptor();

      if (result && !this.isFaceDetected) {
        const bestMatch = this.findBestMatch(result.descriptor);

        if (bestMatch) {
          this.isFaceDetected = true;
          this.detectedEmployee = bestMatch;
          clearInterval(interval);
          const imageData = this.captureSnapshot();
          this.requestLocationAndSave(imageData);
          this.stopVideo();
          this.messageService.add({
            severity: 'success',
            summary: 'Face Detected',
            detail: `Name: ${bestMatch.name}!`,
            life: 4000
          });
          this.detectedUser = `User: ${bestMatch.name}`
        } else {
          this.isFaceDetected = false;
          this.detectedEmployee = null;

          const now = Date.now();
          if (now - this.lastFaceNotRecognizedTime > 10000) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Face Not Recognized',
              detail: 'Your face does not match any employee record.',
              life: 4000
            });
            this.lastFaceNotRecognizedTime = now;
          }
        }
      } else if (!result) {
        // No face detected
        this.isFaceDetected = false;
        this.detectedEmployee = null;
      }
    }, 1000);
  }

  //  find best match face from database
  findBestMatch(queryDescriptor: Float32Array) {
    console.log('findBestMatch called', this.employeeDescriptors);
    let minDistance = 0.4;
    let bestMatch = null;
    for (const emp of this.employeeDescriptors) {
      const distance = faceapi.euclideanDistance(emp.descriptor, queryDescriptor);
      console.log(`Distance to ${emp.name}:`, distance);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = emp;
      }
    }
    return bestMatch;
  }
  // capture image from video 
  captureSnapshot(): string {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    const video = this.videoRef.nativeElement;

    if (ctx) {

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/jpeg');
      console.log('Snapshot taken');
      return imageData;
    }

    return '';
  }

  //after face detected checks for location and proceed punchin
  requestLocationAndSave(imageData: string) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        const lat: number = this.latitude;
        const long: number = this.longitude;
        const timestamp: string = new Date().toLocaleString();

        const punch: Punch = {
          timestamp,
          image: imageData,
          location: {
            lat,
            long
          }
        };

        this.punchData.push(punch);
        this.messageService.add({
          severity: 'success',
          summary: 'Punch-In Successful',
          detail: `You punched in at ${timestamp}`,
          life: 4000
        });

        // store user details in localStorage
        if (this.detectedEmployee) {
          const emp = this.employees.find(e => e.id === this.detectedEmployee.id || e.employeeId === this.detectedEmployee.id);
          if (emp) {
            const userData = {
              name: emp.name,
              email: emp.email,
              mobile: emp.phone || emp.mobile,
              employeeId: emp.employeeId || emp.id,
              location: lat && long ? `${lat}, ${long}` : '',
              punchedTime: timestamp
            };


            localStorage.setItem('punchInUser', JSON.stringify(userData));
          }
        }

        // setTimeout(() => {
        //   this.router.navigate(['/']);
        // }, 1000);

        // this.backToHomePage();
        this.startSession();
      },
      (error) => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Warning',
          detail: `Location permission denied`,
          life: 4000
        });
        this.location_permission = false;
      }
    );
  }

  stopVideo() {
    const stream = this.videoRef.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  // startSession() {
  //   this.sessionActive = true;
  //   this.sessionStartTime = new Date();
  //   // every 10 min
  //   this.locationInterval = setInterval(() => {
  //     this.trackUserLocation();
  //   }, 5 * 1000); //5 sec for fast check
  //   //session time 1 hr
  //   this.sessionTimer = setTimeout(() => {
  //     this.endSession();
  //   }, 60 * 60 * 1000);
  //   console.log("WFH session tracking started.");
  // }

  startSession() {
    this.sessionActive = true;
    this.sessionStartTime = new Date();

    // Log when setInterval is scheduled
    const intervalScheduledAt = performance.now();
    console.log('setInterval scheduled at:', intervalScheduledAt);

    this.locationInterval = setInterval(() => {
      const intervalCallbackAt = performance.now();
      console.log(
        'setInterval callback at:', intervalCallbackAt,
        '| Delay since scheduled:', (intervalCallbackAt - intervalScheduledAt).toFixed(2), 'ms'
      );
      this.trackUserLocation();
    }, 10 * 1000); // 10 sec for fast check

    // Log when setTimeout is scheduled
    const timeoutScheduledAt = performance.now();
    console.log('setTimeout scheduled at:', timeoutScheduledAt);

    this.sessionTimer = setTimeout(() => {
      const timeoutCallbackAt = performance.now();
      console.log(
        'setTimeout callback at:', timeoutCallbackAt,
        '| Delay since scheduled:', (timeoutCallbackAt - timeoutScheduledAt).toFixed(2), 'ms'
      );
      this.endSession();
    }, 60 * 60 * 1000); // 1 hour

    console.log("WFH session tracking started.");
  }

  trackUserLocation() {


    navigator.geolocation.getCurrentPosition(
      (position) => {
        const log: LocationLog = {
          timestamp: new Date().toLocaleString(),
          lat: position.coords.latitude,
          long: position.coords.longitude
        };
        this.locationLogs.push(log);
        console.log(" Location logged:", log);

        this.messageService.add({
          severity: 'info',
          summary: 'Location Tracked',
          detail: `Lat: ${log.lat}, Long: ${log.long}`,
          life: 3000
        });
      },
      (error) => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Location Tracking Error',
          detail: 'Unable to access location.',
          life: 3000
        });
      }
    );
  }

  endSession() {
    if (this.timerWorker) {
      this.timerWorker.postMessage('stop');
      this.timerWorker.terminate();
      this.timerWorker = undefined;
    }
    clearInterval(this.locationInterval);
    // clearTimeout(this.sessionTimer);
    this.sessionActive = false;

    this.messageService.add({
      severity: 'info',
      summary: 'Session Ended',
      detail: 'Your 4-hour session has ended automatically.',
      life: 4000
    });

  }

  downloadPunchData() {
    const data: { punches: Punch[] } = {
      punches: this.punchData
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'punch_log.json';
    link.click();
  }

  downloadLocationLogs() {
    const logBlob = new Blob([JSON.stringify(this.locationLogs, null, 2)], {
      type: 'application/json'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(logBlob);
    link.download = 'location_logs.json';
    link.click();
  }

  retakePunchIn() {
    this.detectedUser = ""
    this.isFaceDetected = false;
    this.latitude = null;
    this.longitude = null;
    this.punchData.pop()

    const ctx = this.canvasRef?.nativeElement?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    }

    this.startVideo();
  }

  backToHomePage() {
    this.router.navigate(['/']);
  }

  confirmBackToHome(event: Event) {
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: 'Are you sure you want to return to the home page?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.backToHomePage();
      }
    });
  }
}