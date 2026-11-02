output "instance_id" { value = aws_instance.node.id }
output "public_ip" { value = aws_instance.node.public_ip }
output "role_name" { value = aws_iam_role.node.name }