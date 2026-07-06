import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import { UserRole } from 'src/common/enums/role.enum'

@Injectable()
export class ParentsServices {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findParentByPhone(phone: string) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('user.parentProfile', 'parentProfile')
      .leftJoinAndSelect('parentProfile.organizationLinks', 'organizationLink')
      .leftJoinAndSelect('organizationLink.organization', 'organization')
      .leftJoinAndSelect('parentProfile.organizationChildren', 'organizationChildren')
      .leftJoinAndSelect('parentProfile.privateChildren', 'privateChildren')
      .where('user.phone = :phone', { phone })
      .getOne()

    // ✅ 1. User مش موجود
    if (!user) {
      return { status: 'not_found' }
    }

    const isParent = user.roles?.some((r) => r.name === UserRole.PARENT)

    // ✅ 2. User موجود بس مش Parent
    if (!isParent || !user.parentProfile) {
      return {
        status: 'not_parent',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
        },
      }
    }

    // ✅ 3. Parent موجود
    const { parentProfile, ...parentInfo } = user

    const children = [
      ...(parentProfile.organizationChildren || []).map((c) => ({
        ...c,
        type: 'organization',
      })),
      ...(parentProfile.privateChildren || []).map((c) => ({
        ...c,
        type: 'private',
      })),
    ]

    return {
      status: 'parent_found',
      parent: {
        ...parentInfo,
        parentProfileId: parentProfile.id,
      },
      children,
    }
  }
}
