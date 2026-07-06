import { Injectable } from '@nestjs/common'
import { OrganizationSignupStrategy } from '../strategies/organization.strategy'
import SignupStrategy from '../strategies/signup.strategy'

@Injectable()
export class SignupStrategyFactory {
  getStrategy(type: string): SignupStrategy | undefined {
    switch (type) {
      case 'organization':
        return new OrganizationSignupStrategy()
    }
  }
}
