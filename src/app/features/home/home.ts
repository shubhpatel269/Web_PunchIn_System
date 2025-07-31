import { Component, OnInit } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { Router} from '@angular/router';
import { CommonModule } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmPopupModule } from 'primeng/confirmpopup';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    CardModule, 
    ButtonModule,  
    ToastModule, 
    ConfirmPopupModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  userData: any = {
    name: '',
    employeeId: '',
    email: '',
    mobile: '',
    location: '',
    punchedTime: ''
  };

  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private router: Router
  ) { }

  ngOnInit() {
    console.log('Home component initialized');
    const data = localStorage.getItem('punchInUser');
    if (data) {
      try {
        this.userData = JSON.parse(data);
        console.log('User data loaded:', this.userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.router.navigate(['/']);
      }
    } else {
      console.warn('No user data found in localStorage');
      this.router.navigate(['/']);
    }
  }

  onLogout() {
    localStorage.removeItem('punchInUser');
    
    this.router.navigateByUrl('/login', { skipLocationChange: false }).then(() => {
    }).catch(err => {
      console.error('Navigation error:', err);
      window.location.href = '/login';
    });
  }

  confirmBackToLogin(event: Event) {
    console.log('Confirmation dialog triggered');
    
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: 'Are you sure you want to return to the login page?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      accept: () => {
        this.onLogout();
      }
    });
  }
}