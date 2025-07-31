import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PunchIn } from './punch-in';

describe('PunchIn', () => {
  let component: PunchIn;
  let fixture: ComponentFixture<PunchIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PunchIn]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PunchIn);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
