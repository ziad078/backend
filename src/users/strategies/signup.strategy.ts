import { User } from 'src/users/entities/user.entity'
import { EntityManager } from 'typeorm'

export default interface SignupStrategy {
  saveExtraData(manager: EntityManager, user: User, dto: any): Promise<void>
}
